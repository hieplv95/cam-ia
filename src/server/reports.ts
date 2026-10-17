import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isReportReason, MAX_REPORT_NOTE, MAX_REPORT_PROMPT, REPORT_IMAGE_DAYS, REPORTS_PER_DAY, type ReportList, type ReportReason, type ReportRow } from '../ai/report';
import type { Caller } from './account';
import { db } from './db';

/**
 * AI results people reported from the app (Google Play's AI-generated content policy). Each report keeps the
 * reported picture (small JPEG in <data>/reports/, deleted after REPORT_IMAGE_DAYS) so the team can review it on
 * the admin page. The table is made on first use, like video_jobs.
 */

const DAY = 86_400_000;
const MAX_IMAGE_BASE64 = 3 * 1024 * 1024;

const imageDir = () => path.join(process.env.CAMI_DATA_DIR ?? path.join(process.cwd(), 'data'), 'reports');

let ready = false;
function table() {
  if (!ready) {
    db().exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        visitor TEXT NOT NULL,
        tool TEXT NOT NULL,
        reason TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open'
      );
      CREATE INDEX IF NOT EXISTS reports_status ON reports (status, created_at);
      CREATE INDEX IF NOT EXISTS reports_visitor ON reports (visitor, created_at);
    `);
    ready = true;
  }
  return db();
}

export class ReportError extends Error {
  constructor(
    public key: 'server.badRequest' | 'report.tooMany',
    public status: number,
  ) {
    super(key);
  }
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Pictures of reports older than REPORT_IMAGE_DAYS are deleted (the report itself stays, without its picture). */
function purgeOldImages() {
  const old = table()
    .prepare("SELECT id, image FROM reports WHERE image != '' AND created_at < ?")
    .all(Date.now() - REPORT_IMAGE_DAYS * DAY) as { id: number; image: string }[];
  for (const r of old) {
    removeImage(r.image);
    table().prepare("UPDATE reports SET image = '' WHERE id = ?").run(r.id);
  }
}

function removeImage(name: string) {
  const file = path.join(imageDir(), name);
  if (name && existsSync(file)) unlinkSync(file);
}

export function addReport(c: Caller, body: { tool?: unknown; reason?: unknown; note?: unknown; prompt?: unknown; image?: unknown }) {
  const tool = clean(body.tool, 60);
  if (!tool || !isReportReason(body.reason)) throw new ReportError('server.badRequest', 400);
  const image = typeof body.image === 'string' ? body.image : '';
  if (image.length > MAX_IMAGE_BASE64 || (image && !/^[A-Za-z0-9+/=]+$/.test(image))) throw new ReportError('server.badRequest', 400);
  const visitor = c.device ?? `ip:${c.ip}`;
  const today = (table().prepare('SELECT COUNT(*) AS n FROM reports WHERE visitor = ? AND created_at > ?').get(visitor, Date.now() - DAY) as { n: number }).n;
  if (today >= REPORTS_PER_DAY) throw new ReportError('report.tooMany', 429);

  purgeOldImages();
  let name = '';
  if (image) {
    name = `${randomBytes(12).toString('hex')}.jpg`;
    mkdirSync(imageDir(), { recursive: true });
    writeFileSync(path.join(imageDir(), name), Buffer.from(image, 'base64'));
  }
  table()
    .prepare('INSERT INTO reports (created_at, user_id, visitor, tool, reason, note, prompt, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(Date.now(), c.user?.id ?? null, visitor, tool, body.reason as ReportReason, clean(body.note, MAX_REPORT_NOTE), clean(body.prompt, MAX_REPORT_PROMPT), name);
}

const PAGE = 20;

export function listReports(status: 'open' | 'done', offset = 0): ReportList {
  purgeOldImages();
  const rows = table()
    .prepare(
      `SELECT r.id, r.created_at, r.user_id, u.email, r.tool, r.reason, r.note, r.prompt, r.image, r.status
       FROM reports r LEFT JOIN users u ON u.id = r.user_id WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(status, PAGE, Math.max(0, offset)) as { id: number; created_at: number; user_id: number | null; email: string | null; tool: string; reason: ReportReason; note: string; prompt: string; image: string; status: 'open' | 'done' }[];
  const counts = table().prepare('SELECT status, COUNT(*) AS n FROM reports GROUP BY status').all() as { status: string; n: number }[];
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const reports: ReportRow[] = rows.map((r) => {
    const file = path.join(imageDir(), r.image);
    return {
      id: r.id,
      createdAt: r.created_at,
      userId: r.user_id,
      email: r.email,
      tool: r.tool,
      reason: r.reason,
      note: r.note,
      prompt: r.prompt,
      image: r.image && existsSync(file) ? readFileSync(file).toString('base64') : null,
      status: r.status,
    };
  });
  return { reports, open: n('open'), done: n('done'), pageSize: PAGE };
}

export const openReportCount = () => (table().prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").get() as { n: number }).n;

/** 'done' / 'reopen' change the status; 'delete' removes the report and its picture. Returns what was acted on. */
export function actOnReport(id: number, action: unknown) {
  const row = table().prepare('SELECT id, tool, reason, image FROM reports WHERE id = ?').get(id) as { id: number; tool: string; reason: string; image: string } | undefined;
  if (!row) return null;
  if (action === 'done' || action === 'reopen') {
    table().prepare('UPDATE reports SET status = ? WHERE id = ?').run(action === 'done' ? 'done' : 'open', id);
  } else if (action === 'delete') {
    removeImage(row.image);
    table().prepare('DELETE FROM reports WHERE id = ?').run(id);
  } else return null;
  return row;
}
