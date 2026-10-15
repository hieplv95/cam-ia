import type { MessageKey, Params } from '../i18n/core';
import { isAdmin } from './admins';
import { creditsOf, type Caller } from './account';
import { db } from './db';
import { periodOf } from './time';

/**
 * Who may make an AI video, and the videos being made (/video).
 * - Guests: GUEST_FREE_VIDEOS per device (a hashed IP caps how often clearing app data resets that), then they must sign up.
 * - Members: each video costs VIDEO_POINTS of their monthly points (recorded in `usage`, like pictures).
 * - Admins: no limit.
 * - Everyone together: at most VIDEO_DAILY_LIMIT videos a day, so a flood of strangers can't drain the AI credit.
 * A failed video is not counted and its points are given back.
 */

export const GUEST_FREE_VIDEOS = 2;
const GUEST_IP_FACTOR = 3;
const GUEST_IP_WINDOW = 30 * 86_400_000;
const DAY = 86_400_000;

export const videoPoints = () => Math.max(1, Number(process.env.VIDEO_POINTS) || 20);
const dailyLimit = () => Math.max(0, Number(process.env.VIDEO_DAILY_LIMIT) || 30);

let ready = false;
function table() {
  if (!ready) {
    db().exec(`
      CREATE TABLE IF NOT EXISTS video_jobs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device TEXT,
        ip TEXT NOT NULL,
        usage_id INTEGER,
        status TEXT NOT NULL DEFAULT 'running',
        created_at INTEGER NOT NULL,
        clips INTEGER NOT NULL DEFAULT 1,
        parts TEXT
      );
      CREATE INDEX IF NOT EXISTS video_jobs_device ON video_jobs (device);
      CREATE INDEX IF NOT EXISTS video_jobs_ip_time ON video_jobs (ip, created_at);
      CREATE INDEX IF NOT EXISTS video_jobs_time ON video_jobs (created_at);
    `);
    // Tables made before 20 / 30 second videos.
    const cols = (db().prepare('PRAGMA table_info(video_jobs)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('clips')) db().exec('ALTER TABLE video_jobs ADD COLUMN clips INTEGER NOT NULL DEFAULT 1');
    if (!cols.includes('parts')) db().exec('ALTER TABLE video_jobs ADD COLUMN parts TEXT');
    ready = true;
  }
  return db();
}

const count = (sql: string, ...args: (string | number)[]) => (table().prepare(sql).get(...args) as { n: number }).n;

/** Free videos a guest has left. */
function guestLeft(c: Caller) {
  const byIp = count("SELECT COALESCE(SUM(clips), 0) AS n FROM video_jobs WHERE user_id IS NULL AND status != 'failed' AND ip = ? AND created_at >= ?", c.ip, Date.now() - GUEST_IP_WINDOW);
  if (byIp >= GUEST_FREE_VIDEOS * GUEST_IP_FACTOR) return 0;
  const byDevice = c.device ? count("SELECT COALESCE(SUM(clips), 0) AS n FROM video_jobs WHERE user_id IS NULL AND status != 'failed' AND device = ?", c.device) : byIp;
  return Math.max(0, GUEST_FREE_VIDEOS - byDevice);
}

/** What the page shows: free videos left for a guest, or the points a video costs a member. */
export type VideoQuota = { kind: 'guest'; left: number; limit: number } | { kind: 'member'; cost: number; left: number; unlimited: boolean };

export function videoQuota(c: Caller): VideoQuota {
  if (!c.user) return { kind: 'guest', left: guestLeft(c), limit: GUEST_FREE_VIDEOS };
  const credits = creditsOf(c);
  return { kind: 'member', cost: videoPoints(), left: credits.left, unlimited: isAdmin(c.user) };
}

export type VideoDenied = { status: number; code: 'login_required' | 'no_points' | 'busy'; key: MessageKey; params?: Params };

/**
 * Checks and reserves a video of `clips` clips before Google is called (no await in between, so parallel requests
 * can't overspend). Returns the usage row to give back if the video fails (members only), or why it can't be made.
 */
export function reserveVideo(c: Caller, clips = 1): { usageId: number | null } | VideoDenied {
  const admin = isAdmin(c.user);
  const today = count("SELECT COALESCE(SUM(clips), 0) AS n FROM video_jobs WHERE status != 'failed' AND created_at >= ?", Date.now() - DAY);
  if (!admin && today + clips > dailyLimit()) return { status: 503, code: 'busy', key: 'video.dailyLimit' };
  if (!c.user) {
    const left = guestLeft(c);
    if (left >= clips) return { usageId: null };
    return left > 0
      ? { status: 401, code: 'login_required', key: 'video.guestTooLong', params: { left } }
      : { status: 401, code: 'login_required', key: 'video.guestOut', params: { n: GUEST_FREE_VIDEOS } };
  }
  const cost = videoPoints() * clips;
  const left = creditsOf(c).left;
  if (!admin && left < cost) return { status: 402, code: 'no_points', key: 'video.noPoints', params: { cost, left } };
  const id = table()
    .prepare('INSERT INTO usage (user_id, device, ip, model, points, created_at, period) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(c.user.id, null, c.ip, 'video', cost, Date.now(), periodOf()).lastInsertRowid;
  return { usageId: Number(id) };
}

export const isVideoDenied = (r: { usageId: number | null } | VideoDenied): r is VideoDenied => 'code' in r;

/** Gives back a reservation when Google refused to start the video. */
export function releaseVideo(usageId: number | null) {
  if (usageId) table().prepare('DELETE FROM usage WHERE id = ?').run(usageId);
}

/** One clip made by one AI source. */
export type VideoPart = { id: string; source: string };

/** A video of one clip keeps that clip's id; a longer one gets its own id and lists its clips in `parts`. */
export function recordJob(c: Caller, id: string, parts: VideoPart[], usageId: number | null) {
  table()
    .prepare('INSERT INTO video_jobs (id, source, user_id, device, ip, usage_id, status, created_at, clips, parts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, parts[0].source, c.user?.id ?? null, c.user ? null : c.device, c.ip, usageId, 'running', Date.now(), parts.length, parts.length > 1 ? JSON.stringify(parts) : null);
}

type JobRow = { id: string; source: string; user_id: number | null; device: string | null; ip: string; usage_id: number | null; status: string; clips: number; parts: string | null };

/** The clips of a job, in order. */
export const partsOf = (row: JobRow): VideoPart[] => (row.parts ? JSON.parse(row.parts) : [{ id: row.id, source: row.source }]);

/** The caller's own job (a guest's by device, or by IP without one), or null. */
export function jobOf(c: Caller, id: string): JobRow | null {
  const row = table().prepare('SELECT * FROM video_jobs WHERE id = ?').get(id) as JobRow | undefined;
  if (!row) return null;
  const mine = c.user ? row.user_id === c.user.id : row.user_id === null && (c.device ? row.device === c.device : row.ip === c.ip);
  return mine || isAdmin(c.user) ? row : null;
}

/** Marks a job finished; a failed one is not counted and its points come back. */
export function finishJob(row: JobRow, ok: boolean) {
  if (row.status !== 'running') return;
  table().prepare('UPDATE video_jobs SET status = ? WHERE id = ?').run(ok ? 'done' : 'failed', row.id);
  if (!ok) releaseVideo(row.usage_id);
}
