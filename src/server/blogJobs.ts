import type { SQLInputValue } from 'node:sqlite';

import type { BlogJob, BlogWriteRequest } from '../blog/types';
import { translate } from '../i18n/core';
import type { AccountUser } from '../ai/credits';
import type { Caller } from './account';
import { audit } from './admin';
import { saveImage, savePost } from './blog';
import { drawBlogImage, writeArticle } from './blogAi';
import { setTopicStatus, topicById } from './blogTopics';
import { db } from './db';
import { claudeErrorText } from './claude';
import { AiError } from './gemini';
import { stampJpeg } from './stamp';
import { logAi } from './stats';

/**
 * AI articles written in the background, so the admin can queue several and even close the page: up to MAX_RUNNING
 * at once, the others wait their turn. Progress lives in blog_jobs; the admin page polls it.
 * A job that was running when the server restarted is marked as failed (the work in memory is gone).
 */

const MAX_RUNNING = 3;

type Row = { id: number; lang: string; topic: string; status: BlogJob['status']; step: string; post_id: number | null; error: string; created_at: number; updated_at: number };
type Work = { req: BlogWriteRequest & { logo: boolean }; who: Caller; admin: AccountUser };

/** Kept on globalThis so dev reloads don't lose track of running work. */
const g = globalThis as unknown as { __camiBlogJobs?: { running: Set<number>; queue: number[]; work: Map<number, Work> } };
const state = (g.__camiBlogJobs ??= { running: new Set<number>(), queue: [] as number[], work: new Map<number, Work>() });

const all = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).all(...args) as T[];

function update(id: number, patch: { status?: BlogJob['status']; step?: string; postId?: number; error?: string }) {
  db()
    .prepare('UPDATE blog_jobs SET status = COALESCE(?, status), step = COALESCE(?, step), post_id = COALESCE(?, post_id), error = COALESCE(?, error), updated_at = ? WHERE id = ?')
    .run(patch.status ?? null, patch.step ?? null, patch.postId ?? null, patch.error ?? null, Date.now(), id);
}

/** Queues an article; returns at once. */
export function enqueueArticle(req: BlogWriteRequest & { logo: boolean }, who: Caller, admin: AccountUser): BlogJob {
  const now = Date.now();
  const id = Number(
    db()
      .prepare("INSERT INTO blog_jobs (lang, topic, status, step, created_at, updated_at) VALUES (?, ?, 'queued', 'Đang chờ lượt', ?, ?)")
      .run(req.lang, req.topic, now, now).lastInsertRowid,
  );
  state.work.set(id, { req, who, admin });
  state.queue.push(id);
  pump();
  return jobById(id)!;
}

function pump() {
  while (state.running.size < MAX_RUNNING && state.queue.length) {
    const id = state.queue.shift()!;
    state.running.add(id);
    run(id)
      .catch((e) => console.error('[blog job]', id, e))
      .finally(() => {
        state.running.delete(id);
        state.work.delete(id);
        pump();
      });
  }
  // Tell the waiting ones where they are in the line.
  state.queue.forEach((id, i) => update(id, { step: `Đang chờ lượt (thứ ${i + 1})` }));
}

async function run(id: number) {
  const work = state.work.get(id);
  if (!work) return;
  const { req, who, admin } = work;
  let started = Date.now();
  try {
    update(id, { status: 'running', step: 'AI đang viết bài… (30–90 giây)' });
    const topic = req.topicId ? topicById(req.topicId) : null;
    if (topic && !req.cluster) req.cluster = topic.cluster;
    const r = await writeArticle(req);
    logAi(who, { tool: 'blog.write', model: r.model, status: 'ok', ms: Date.now() - started, source: r.source, usd: r.usd });
    const a = r.article;
    let post = savePost(
      { lang: req.lang, title: a.title, slug: a.slug, description: a.description, keywords: a.keywords, content: a.content, cover: '', cluster: a.cluster, status: req.publish && !a.images.length ? 'published' : 'draft' },
      { ai: true },
    );
    if (topic) setTopicStatus(topic.id, 'written', post.id);
    update(id, { postId: post.id });

    let content = post.content;
    let cover = '';
    const failed: number[] = [];
    for (let i = 0; i < a.images.length; i++) {
      const plan = a.images[i];
      const tag = `[[IMAGE ${i + 1}]]`;
      started = Date.now();
      try {
        update(id, { step: `Đang vẽ ảnh ${i + 1}/${a.images.length}… (20–30 giây mỗi ảnh)` });
        const drawn = await drawBlogImage(plan.prompt);
        logAi(who, { tool: 'blog.image', model: drawn.model, status: 'ok', ms: Date.now() - started, source: drawn.source });
        const name = saveImage(await stampJpeg(drawn.image, req.logo));
        if (!cover) cover = name;
        const md = `![${plan.alt.replace(/[[\]]/g, '')}](/api/blog/image/${name})`;
        content = content.includes(tag) ? content.replace(tag, md) : `${content}\n\n${md}`;
      } catch (e) {
        failed.push(i + 1);
        logAi(who, { tool: 'blog.image', model: 'image', status: 'error', error: e instanceof AiError ? e.key : 'unexpected', ms: Date.now() - started });
        console.error('[blog job] picture', id, i + 1, e);
      }
    }
    if (a.images.length) {
      // Pictures that could not be drawn leave no placeholder behind.
      content = content.replace(/^\s*\[\[IMAGE \d+\]\]\s*$/gim, '').replace(/\n{3,}/g, '\n\n');
      update(id, { step: 'Đang lưu bài viết…' });
      post = savePost({ id: post.id, slug: post.slug, lang: post.lang, title: post.title, description: post.description, keywords: post.keywords, content, cover, status: req.publish ? 'published' : 'draft' });
    }
    audit(admin, 'blog', null, `AI viết bài #${post.id} (${req.lang}): ${post.title}`);
    update(id, {
      status: 'done',
      step: `${post.status === 'published' ? 'Đã đăng' : 'Xong, đang là bản nháp'}${failed.length ? ` · không vẽ được ảnh ${failed.join(', ')}` : ''}`,
    });
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith('AI trả về'))) {
      logAi(who, { tool: 'blog.write', model: req.model, status: 'error', error: e instanceof AiError ? e.key : 'unexpected', ms: Date.now() - started });
    }
    const message = claudeErrorText(e) ?? (e instanceof AiError ? translate('vi', e.key) : e instanceof Error ? e.message : 'Lỗi không rõ.');
    update(id, { status: 'error', step: 'Lỗi', error: message });
  }
}

const toJob = (r: Row): BlogJob => ({ id: r.id, lang: r.lang, topic: r.topic, status: r.status, step: r.step, postId: r.post_id, error: r.error, createdAt: r.created_at, updatedAt: r.updated_at });

export function jobById(id: number) {
  const r = db().prepare('SELECT * FROM blog_jobs WHERE id = ?').get(id) as Row | undefined;
  return r ? toJob(r) : null;
}

/** Waiting and running jobs, plus those finished in the last 24 hours (newest first). */
export function recentJobs(): BlogJob[] {
  // Unfinished jobs this server doesn't know about were cut off by a restart.
  const orphans = all<{ id: number }>("SELECT id FROM blog_jobs WHERE status IN ('queued', 'running')").filter((j) => !state.running.has(j.id) && !state.queue.includes(j.id));
  for (const j of orphans) update(j.id, { status: 'error', step: 'Lỗi', error: 'Máy chủ khởi động lại khi đang viết: bấm Viết bài lại.' });
  return all<Row>(
    "SELECT * FROM blog_jobs WHERE status IN ('queued', 'running') OR created_at > ? ORDER BY created_at DESC LIMIT 20",
    Date.now() - 24 * 3_600_000,
  ).map(toJob);
}

/** Hides a finished job from the list. */
export function dismissJob(id: number) {
  db().prepare("DELETE FROM blog_jobs WHERE id = ? AND status IN ('done', 'error')").run(id);
}
