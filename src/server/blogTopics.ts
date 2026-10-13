import type { SQLInputValue } from 'node:sqlite';

import { BLOG_CLUSTERS, isClusterId, type BlogTopic, type ClusterCoverage, type TopicDifficulty, type TopicPriority } from '../blog/clusters';
import { db } from './db';

/**
 * Topic ideas the AI suggested for the blog (table blog_topics): remembered with their status (suggested / written /
 * skipped) so the next batch avoids all of them, checked against existing articles for near-duplicates, and counted
 * per keyword group for the coverage board.
 */

type Row = {
  id: number;
  lang: string;
  title: string;
  keyword: string;
  cluster: string;
  difficulty: TopicDifficulty;
  priority: TopicPriority;
  reason: string;
  similar: string;
  status: BlogTopic['status'];
  post_id: number | null;
  created_at: number;
};

const all = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).all(...args) as T[];

const toTopic = (r: Row): BlogTopic => ({
  id: r.id,
  lang: r.lang,
  title: r.title,
  keyword: r.keyword,
  cluster: r.cluster,
  difficulty: r.difficulty,
  priority: r.priority,
  reason: r.reason,
  similar: r.similar,
  status: r.status,
  postId: r.post_id,
  createdAt: r.created_at,
});

/** Ideas still waiting to be written in `lang`, best first. */
export function pendingTopics(lang: string): BlogTopic[] {
  return all<Row>(
    `SELECT * FROM blog_topics WHERE lang = ? AND status = 'suggested'
     ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC`,
    lang,
  ).map(toTopic);
}

/** Everything the AI must not suggest again in `lang`: earlier ideas (any status) and existing articles. */
export function avoidList(lang: string, limit = 250) {
  const topics = all<{ title: string; keyword: string; status: string }>('SELECT title, keyword, status FROM blog_topics WHERE lang = ? ORDER BY created_at DESC LIMIT ?', lang, limit);
  const posts = all<{ title: string; keywords: string }>('SELECT title, keywords FROM blog_posts WHERE lang = ? ORDER BY created_at DESC LIMIT ?', lang, limit);
  return { topics, posts };
}

/** Per keyword group: articles (published / drafts) and ideas (waiting / skipped) in `lang`. */
export function coverage(lang: string): ClusterCoverage[] {
  const posts = all<{ cluster: string; status: string; n: number }>('SELECT cluster, status, COUNT(*) AS n FROM blog_posts WHERE lang = ? GROUP BY cluster, status', lang);
  const topics = all<{ cluster: string; status: string; n: number }>("SELECT cluster, status, COUNT(*) AS n FROM blog_topics WHERE lang = ? AND status != 'written' GROUP BY cluster, status", lang);
  const ids = [...BLOG_CLUSTERS.map((c) => c.id as string), ''];
  return ids.map((cluster) => ({
    cluster,
    published: posts.find((p) => p.cluster === cluster && p.status === 'published')?.n ?? 0,
    drafts: posts.find((p) => p.cluster === cluster && p.status === 'draft')?.n ?? 0,
    suggested: topics.find((t) => t.cluster === cluster && t.status === 'suggested')?.n ?? 0,
    skipped: topics.find((t) => t.cluster === cluster && t.status === 'skipped')?.n ?? 0,
  }));
}

/* ---------- Near-duplicates ---------- */

/** Short words that say nothing about the topic (several languages). */
const STOP = new Set(
  'the and for with your you how what why best free online app apps photo photos con los las del para por una uno que como cómo mejor gratis tus sus foto fotos com uma das dos seu sua grátis les des une pour avec vos und mit für die der das ein eine dein bằng cho của và với các những ảnh cách'.split(' '),
);

/** "¿Cómo quitar el fondo de una foto?" → {quitar, fondo} (accents removed, short and common words dropped). */
export function topicWords(text: string) {
  return new Set(
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** How much two topics overlap (0..1): shared words / all words. */
export function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

const SIMILAR = 0.5;

/** The existing article or idea `title`/`keyword` looks like, or ''. */
function similarTo(title: string, keyword: string, known: { title: string; keyword: string }[]) {
  const words = topicWords(`${title} ${keyword}`);
  const kw = keyword.trim().toLowerCase();
  let best = { score: 0, title: '' };
  for (const k of known) {
    const score = kw && k.keyword.trim().toLowerCase() === kw ? 1 : overlap(words, topicWords(`${k.title} ${k.keyword}`));
    if (score > best.score) best = { score, title: k.title };
  }
  return best.score >= SIMILAR ? best.title : '';
}

/* ---------- Saving ---------- */

export type NewTopic = { title: string; keyword: string; cluster: string; difficulty: string; priority: string; reason: string };

const DIFFICULTIES: TopicDifficulty[] = ['low', 'medium', 'high'];
const PRIORITIES: TopicPriority[] = ['high', 'medium', 'low'];

/**
 * Stores up to `limit` ideas from the AI: drops exact repeats of earlier ideas, keeps at most `maxPerCluster` per group,
 * and marks near-duplicates of articles or ideas (they are kept, with a warning on the card).
 */
export function saveSuggestions(lang: string, items: NewTopic[], maxPerCluster: number, limit: number): BlogTopic[] {
  const { topics, posts } = avoidList(lang, 1000);
  const known = [...topics.map((t) => ({ title: t.title, keyword: t.keyword })), ...posts.map((p) => ({ title: p.title, keyword: p.keywords.split(',')[0] ?? '' }))];
  const seen = new Set(topics.map((t) => t.title.trim().toLowerCase()));
  const perCluster = new Map<string, number>();
  const insert = db().prepare(
    `INSERT INTO blog_topics (lang, title, keyword, cluster, difficulty, priority, reason, similar, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?)`,
  );
  const ids: number[] = [];
  const now = Date.now();
  for (const item of items) {
    if (ids.length >= limit) break;
    const title = item.title.trim().slice(0, 140);
    if (!title || seen.has(title.toLowerCase())) continue;
    const cluster = isClusterId(item.cluster) ? item.cluster : '';
    const count = perCluster.get(cluster) ?? 0;
    if (count >= maxPerCluster) continue;
    perCluster.set(cluster, count + 1);
    seen.add(title.toLowerCase());
    const keyword = item.keyword.trim().slice(0, 120);
    const difficulty = DIFFICULTIES.includes(item.difficulty as TopicDifficulty) ? item.difficulty : 'medium';
    const priority = PRIORITIES.includes(item.priority as TopicPriority) ? item.priority : 'medium';
    const similar = similarTo(title, keyword, known);
    ids.push(Number(insert.run(lang, title, keyword, cluster, difficulty, priority, item.reason.trim().slice(0, 300), similar, now, now).lastInsertRowid));
    known.push({ title, keyword });
  }
  if (!ids.length) return [];
  return all<Row>(`SELECT * FROM blog_topics WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids).map(toTopic);
}

export function setTopicStatus(id: number, status: BlogTopic['status'], postId?: number) {
  db().prepare('UPDATE blog_topics SET status = ?, post_id = COALESCE(?, post_id), updated_at = ? WHERE id = ?').run(status, postId ?? null, Date.now(), id);
}

export const topicById = (id: number) => {
  const r = db().prepare('SELECT * FROM blog_topics WHERE id = ?').get(id) as Row | undefined;
  return r ? toTopic(r) : null;
};
