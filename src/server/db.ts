import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { dayOf, periodOf } from './time';

/**
 * Accounts, sessions and AI usage live in one SQLite file (data/cami.db, kept out of git), like nails-studio.
 * The API routes run in one Node process, so a single connection kept on globalThis is enough
 * (it survives dev reloads). Bump SCHEMA when the tables change.
 */
export const SCHEMA = 7;
const g = globalThis as unknown as { __camiDb?: DatabaseSync; __camiDbSchema?: number };

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      disabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS users_ip_time ON users (ip, created_at);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    -- One row per AI result: points for members, a free try for guests (device + hashed IP, never the raw IP).
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      device TEXT,
      ip TEXT NOT NULL,
      model TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS usage_user_time ON usage (user_id, created_at);
    CREATE INDEX IF NOT EXISTS usage_device ON usage (device);
    CREATE INDEX IF NOT EXISTS usage_ip_time ON usage (ip, created_at);
    -- Bonus points (invites, shares). They never expire and are spent after the monthly allowance.
    CREATE TABLE IF NOT EXISTS bonus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('referral', 'referred', 'share')),
      ref TEXT NOT NULL DEFAULT '',
      period TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bonus_user ON bonus (user_id, reason, period);
  `);
  const cols = (table: string) => new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
  // Month of each AI result in the app's time zone: monthly points are counted per month, the rest comes from bonus.
  if (!cols('usage').has('period')) {
    db.exec("ALTER TABLE usage ADD COLUMN period TEXT NOT NULL DEFAULT ''");
    const rows = db.prepare('SELECT id, created_at FROM usage').all() as { id: number; created_at: number }[];
    const update = db.prepare('UPDATE usage SET period = ? WHERE id = ?');
    for (const r of rows) update.run(periodOf(r.created_at), r.id);
  }
  db.exec('CREATE INDEX IF NOT EXISTS usage_user_period ON usage (user_id, period)');
  const users = cols('users');
  if (!users.has('ref_code')) db.exec('ALTER TABLE users ADD COLUMN ref_code TEXT');
  if (!users.has('referred_by')) db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_ref_code ON users (ref_code)');
  // Network and device of each sign-in, so visits from the owner's own phone or wifi don't earn share points.
  const sessions = cols('sessions');
  if (!sessions.has('ip')) db.exec("ALTER TABLE sessions ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
  if (!sessions.has('device')) db.exec("ALTER TABLE sessions ADD COLUMN device TEXT NOT NULL DEFAULT ''");
  // People who opened someone's shared link (one row per visitor per month); source 'fb' = shared on Facebook.
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      device TEXT,
      ip TEXT NOT NULL,
      period TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS visits_owner ON visits (owner_id, period, source);
  `);
  migrateStats(db, cols);
  // Schema 5: which AI source answered (for each source's credit), and settings edited on the admin page.
  if (!cols('ai_log').has('source')) db.exec("ALTER TABLE ai_log ADD COLUMN source TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE INDEX IF NOT EXISTS ai_log_source ON ai_log (source, created_at);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // Schema 6: monthly points as they were each month, so changing them on the admin page
  // doesn't rewrite how much bonus was used in earlier months.
  db.exec('CREATE TABLE IF NOT EXISTS monthly_allowance (period TEXT PRIMARY KEY, points INTEGER NOT NULL)');
  // Schema 7: who is online, from a heartbeat the app sends while it is on screen (see src/server/presence.ts).
  // - presence: one row per visitor (device id, or hashed IP), with its current visit;
  // - app_visits: each visit (heartbeats with no long gap), for visits, users and time spent per period;
  // - online_hours: most people online at once, and heartbeats, per hour;
  // - screen_time: heartbeats per screen and day (each one ≈ HEARTBEAT seconds spent there).
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      platform TEXT NOT NULL DEFAULT '',
      started_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS app_visits_time ON app_visits (started_at, last_seen);
    CREATE TABLE IF NOT EXISTS presence (
      visitor TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      platform TEXT NOT NULL DEFAULT '',
      screen TEXT NOT NULL DEFAULT '',
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      visit_id INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS presence_seen ON presence (last_seen);
    CREATE TABLE IF NOT EXISTS online_hours (
      day TEXT NOT NULL,
      hour INTEGER NOT NULL,
      peak INTEGER NOT NULL,
      peak_at INTEGER NOT NULL,
      PRIMARY KEY (day, hour)
    );
    CREATE TABLE IF NOT EXISTS screen_time (
      day TEXT NOT NULL,
      screen TEXT NOT NULL,
      beats INTEGER NOT NULL,
      PRIMARY KEY (day, screen)
    );
  `);
}

/** Settings edited on the admin page (key → JSON text); null when never set. */
export function getSetting(key: string): string | null {
  return (db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  if (value === null) db().prepare('DELETE FROM settings WHERE key = ?').run(key);
  else db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
}

/**
 * Statistics for the admin dashboard (schema 4):
 * - ai_log: every AI request with its feature, model, outcome and time (usage only keeps what was charged);
 * - actives: who opened the app each day (device id or hashed IP), for daily active users;
 * - events: per-day counters of features that run on the phone (saving photos, presets…), with no personal data;
 * - admin_log: what admins changed (bonus points given, accounts locked).
 * Bonus points may also come from an admin ('admin' reason).
 */
function migrateStats(db: DatabaseSync, cols: (table: string) => Set<string>) {
  const hadLog = cols('ai_log').size > 0;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      day TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      member INTEGER NOT NULL,
      tool TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT NOT NULL DEFAULT '',
      ms INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      usd REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ai_log_day ON ai_log (day, status);
    CREATE INDEX IF NOT EXISTS ai_log_user ON ai_log (user_id, created_at);
    CREATE TABLE IF NOT EXISTS actives (
      day TEXT NOT NULL,
      visitor TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (day, visitor)
    );
    CREATE INDEX IF NOT EXISTS actives_user ON actives (user_id, day);
    CREATE TABLE IF NOT EXISTS events (
      day TEXT NOT NULL,
      name TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      n INTEGER NOT NULL,
      PRIMARY KEY (day, name, detail)
    );
    CREATE TABLE IF NOT EXISTS admin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      detail TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS admin_log_user ON admin_log (user_id, created_at);
  `);
  // AI results from before the log existed still count in the charts (feature unknown).
  if (!hadLog) {
    const rows = db.prepare('SELECT user_id, model, points, created_at FROM usage').all() as {
      user_id: number | null;
      model: string;
      points: number;
      created_at: number;
    }[];
    const insert = db.prepare(
      "INSERT INTO ai_log (created_at, day, user_id, member, tool, model, status, points) VALUES (?, ?, ?, ?, '', ?, 'ok', ?)",
    );
    for (const r of rows) insert.run(r.created_at, dayOf(r.created_at), r.user_id, r.user_id ? 1 : 0, r.model, r.points);
  }
  // SQLite can't change a CHECK constraint in place: rebuild the bonus table to also accept 'admin'.
  const bonusSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bonus'").get() as { sql: string }).sql;
  if (!bonusSql.includes("'admin'")) {
    db.exec(`
      BEGIN;
      CREATE TABLE bonus_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('referral', 'referred', 'share', 'admin')),
        ref TEXT NOT NULL DEFAULT '',
        period TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      INSERT INTO bonus_new (id, user_id, points, reason, ref, period, created_at)
        SELECT id, user_id, points, reason, ref, period, created_at FROM bonus;
      DROP TABLE bonus;
      ALTER TABLE bonus_new RENAME TO bonus;
      CREATE INDEX IF NOT EXISTS bonus_user ON bonus (user_id, reason, period);
      COMMIT;
    `);
  }
}

/** Where the database file lives (shown on the admin page). */
export const dbFile = () => path.join(process.env.CAMI_DATA_DIR ?? path.join(process.cwd(), 'data'), 'cami.db');

export function db() {
  if (!g.__camiDb) {
    mkdirSync(path.dirname(dbFile()), { recursive: true });
    g.__camiDb = new DatabaseSync(dbFile());
  }
  if (g.__camiDbSchema !== SCHEMA) {
    migrate(g.__camiDb);
    g.__camiDbSchema = SCHEMA;
  }
  return g.__camiDb;
}
