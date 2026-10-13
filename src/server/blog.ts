import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { SQLInputValue } from 'node:sqlite';

import { blogImageUrl, readingMinutes, type BlogDraft, type BlogPost, type BlogStatus, type BlogSummary } from '../blog/types';
import { isClusterId } from '../blog/clusters';
import { isLang, type Lang } from '../i18n/languages';
import { db } from './db';

/**
 * Blog articles (table blog_posts) and their pictures (JPEG files in <data>/blog/, next to the database so they are
 * backed up together). Written on the admin page, by hand or with AI (blogAi.ts); public pages read published ones.
 */

type Row = {
  id: number;
  slug: string;
  lang: string;
  title: string;
  description: string;
  keywords: string;
  content: string;
  cover: string;
  status: BlogStatus;
  cluster: string;
  ai: number;
  created_at: number;
  updated_at: number;
  published_at: number | null;
};

export class BlogError extends Error {}

const all = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).all(...args) as T[];
const get = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).get(...args) as T | undefined;

const summary = (r: Row): BlogSummary => ({
  id: r.id,
  slug: r.slug,
  lang: (isLang(r.lang) ? r.lang : 'es') as Lang,
  title: r.title,
  description: r.description,
  cover: r.cover ? blogImageUrl(r.cover) : '',
  status: r.status,
  cluster: r.cluster ?? '',
  ai: !!r.ai,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  publishedAt: r.published_at,
  minutes: readingMinutes(r.content),
});
const full = (r: Row): BlogPost => ({ ...summary(r), keywords: r.keywords, content: r.content });

/* ---------- Reading ---------- */

/** Published articles, newest first; in `lang` when given. */
export function publishedPosts(lang?: Lang, limit = 50): BlogSummary[] {
  const rows = lang
    ? all<Row>("SELECT * FROM blog_posts WHERE status = 'published' AND lang = ? ORDER BY published_at DESC LIMIT ?", lang, limit)
    : all<Row>("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ?", limit);
  return rows.map(summary);
}

export function publishedPost(slug: string): BlogPost | null {
  const r = get<Row>("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'", slug);
  return r ? full(r) : null;
}

/** Slugs and dates of every published article (sitemap). */
export const publishedSlugs = () => all<{ slug: string; updated_at: number }>("SELECT slug, updated_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC");

/** Admin: every article, newest first. */
export const allPosts = (): BlogSummary[] => all<Row>('SELECT * FROM blog_posts ORDER BY created_at DESC').map(summary);

export function postById(id: number): BlogPost | null {
  const r = get<Row>('SELECT * FROM blog_posts WHERE id = ?', id);
  return r ? full(r) : null;
}

/* ---------- Writing ---------- */

/** "¿Cómo restaurar fotos antiguas?" → "como-restaurar-fotos-antiguas"; non-Latin titles fall back to "post-<time>". */
export function slugify(text: string) {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug.length >= 3 ? slug : `post-${Date.now().toString(36)}`;
}

/** A slug no other article uses (adds -2, -3…). */
function freeSlug(wanted: string, exceptId?: number) {
  const base = slugify(wanted);
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = get<{ id: number }>('SELECT id FROM blog_posts WHERE slug = ?', slug);
    if (!taken || taken.id === exceptId) return slug;
  }
}

const LIMITS = { title: 120, description: 300, keywords: 400, content: 100_000 };

/** Picture file name from what the editor holds (a /api/blog/image/… URL or the bare name). */
const coverName = (cover: string) => {
  const name = cover.split('/').pop() ?? '';
  return IMAGE_NAME.test(name) ? name : '';
};

/** Creates or updates an article from the admin page. */
export function savePost(input: Partial<BlogDraft>, opts: { ai?: boolean } = {}): BlogPost {
  const title = String(input.title ?? '').trim();
  const content = String(input.content ?? '').trim();
  if (!title) throw new BlogError('Bài viết cần có tiêu đề.');
  if (!content) throw new BlogError('Bài viết chưa có nội dung.');
  if (!isLang(input.lang)) throw new BlogError('Ngôn ngữ không hợp lệ.');
  const description = String(input.description ?? '').replace(/\s+/g, ' ').trim();
  const keywords = String(input.keywords ?? '').replace(/\s+/g, ' ').trim();
  if (title.length > LIMITS.title) throw new BlogError(`Tiêu đề dài quá ${LIMITS.title} ký tự.`);
  if (description.length > LIMITS.description) throw new BlogError(`Mô tả dài quá ${LIMITS.description} ký tự.`);
  if (keywords.length > LIMITS.keywords) throw new BlogError(`Từ khoá dài quá ${LIMITS.keywords} ký tự.`);
  if (content.length > LIMITS.content) throw new BlogError('Nội dung dài quá.');
  const status: BlogStatus = input.status === 'published' ? 'published' : 'draft';
  const cover = coverName(String(input.cover ?? ''));
  // Not sent (e.g. saving after the pictures are drawn) = keep the article's group.
  const newCluster = input.cluster === undefined ? null : isClusterId(input.cluster) ? input.cluster : '';
  const now = Date.now();

  if (input.id) {
    const before = postById(input.id);
    if (!before) throw new BlogError('Không tìm thấy bài viết.');
    const slug = freeSlug(String(input.slug || title), input.id);
    const publishedAt = status === 'published' ? (before.publishedAt ?? now) : before.publishedAt;
    const cluster = newCluster ?? before.cluster;
    db()
      .prepare(
        `UPDATE blog_posts SET slug = ?, lang = ?, title = ?, description = ?, keywords = ?, content = ?, cover = ?, status = ?,
         cluster = ?, updated_at = ?, published_at = ? WHERE id = ?`,
      )
      .run(slug, input.lang, title, description, keywords, content, cover, status, cluster, now, publishedAt, input.id);
    return postById(input.id)!;
  }
  const slug = freeSlug(String(input.slug || title));
  const cluster = newCluster ?? '';
  const id = Number(
    db()
      .prepare(
        `INSERT INTO blog_posts (slug, lang, title, description, keywords, content, cover, status, cluster, ai, created_at, updated_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slug, input.lang, title, description, keywords, content, cover, status, cluster, opts.ai ? 1 : 0, now, now, status === 'published' ? now : null).lastInsertRowid,
  );
  return postById(id)!;
}

export function setStatus(id: number, status: BlogStatus) {
  const before = postById(id);
  if (!before) throw new BlogError('Không tìm thấy bài viết.');
  const now = Date.now();
  db()
    .prepare('UPDATE blog_posts SET status = ?, updated_at = ?, published_at = ? WHERE id = ?')
    .run(status, now, status === 'published' ? (before.publishedAt ?? now) : before.publishedAt, id);
  return postById(id)!;
}

/** Deletes the article and the pictures only it uses. */
export function deletePost(id: number) {
  const post = postById(id);
  if (!post) return;
  db().prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
  const others = all<{ content: string; cover: string }>('SELECT content, cover FROM blog_posts').map((r) => `${r.content} ${r.cover}`).join(' ');
  for (const name of imagesIn(`${post.content} ${post.cover}`)) {
    if (others.includes(name)) continue;
    try {
      unlinkSync(imagePath(name));
    } catch {
      // Already gone.
    }
  }
}

/* ---------- Pictures ---------- */

const IMAGE_NAME = /^[a-f0-9]{24}\.jpg$/;
const imageDir = () => path.join(process.env.CAMI_DATA_DIR ?? path.join(process.cwd(), 'data'), 'blog');
const imagePath = (name: string) => path.join(imageDir(), name);
const imagesIn = (text: string) => [...new Set(text.match(/[a-f0-9]{24}\.jpg/g) ?? [])];

/** Largest picture the admin page may upload (they are resized and compressed before). */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Stores a JPEG (base64 from the admin page) and returns its file name. */
export function saveImage(base64: string) {
  const bytes = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new BlogError('Ảnh phải là JPEG.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new BlogError('Ảnh lớn quá 4 MB.');
  mkdirSync(imageDir(), { recursive: true });
  const name = `${randomBytes(12).toString('hex')}.jpg`;
  writeFileSync(imagePath(name), bytes);
  return name;
}

/** The picture's bytes, or null when the name is not one of ours. */
export function readImage(name: string) {
  if (!IMAGE_NAME.test(name) || !existsSync(imagePath(name))) return null;
  return readFileSync(imagePath(name));
}
