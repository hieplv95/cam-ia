import { existsSync, statSync } from 'node:fs';
import type { SQLInputValue } from 'node:sqlite';

import type { AiSettings, AiStatus, Check, Overview, SystemInfo, ToolStat, UserDetail, UserList, UserRow, UserSort } from '../admin/types';
import {
  type AccountUser,
} from '../ai/credits';
import { DEFAULT_IMAGE_MODEL, imageModels } from '../ai/models';
import { caller, memberPoints } from './account';
import { adminEmails, isAdmin } from './admins';
import { getPlan } from './plan';
import { getRewardPoints } from './rewards';
import { db, dbFile, SCHEMA } from './db';
import { creditState, getAiSources, storedView } from './aiSources';
import { hasClaude } from './claude';
import { aiSourceSummary, retryIn } from './gemini';
import { dayLabel, dayOf, lastDays, monthWindow, periodOf, startOfDay, timeZone } from './time';

/**
 * The admin dashboard: statistics, customer accounts and server health.
 * Admins are the accounts whose email is listed in ADMIN_EMAILS (admins.ts); they sign in like any user.
 * Nothing here returns password hashes, session tokens, IPs or API keys.
 */

export { adminEmails, isAdmin };

/** The signed-in admin, or the error response to send back. */
export function adminOf(request: Request): AccountUser | Response {
  const { user } = caller(request);
  if (isAdmin(user)) return user;
  return Response.json({ error: user ? 'Tài khoản này không có quyền quản trị.' : 'Hãy đăng nhập bằng tài khoản quản trị.' }, { status: user ? 403 : 401 });
}

const get = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).get(...args) as T;
const all = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).all(...args) as T[];
const count = (sql: string, ...args: SQLInputValue[]) => get<{ n: number | null }>(sql, ...args).n ?? 0;
const round2 = (x: number) => Math.round(x * 100) / 100;

/* ---------- Dashboard ---------- */

export function overview(days: number): Overview {
  const now = Date.now();
  const range = days === -1 ? [lastDays(2, now)[0]] : lastDays(days, now);
  const from = range[0];
  const today = range[range.length - 1];
  const since = startOfDay(from);
  const nextDay = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const until = startOfDay(nextDay);
  const month = monthWindow(now);

  const signups = all<{ created_at: number; referred_by: number | null }>('SELECT created_at, referred_by FROM users WHERE created_at >= ? AND created_at < ?', since, until)
    .map((u) => ({ day: dayOf(u.created_at), referred: u.referred_by !== null }))
    .filter((u) => u.day >= from && u.day <= today);

  const ai = get<{ ok: number; error: number; denied: number; guestDenied: number; blocked: number; usd: number; points: number; avgMs: number; okToday: number }>(
    `SELECT COALESCE(SUM(status = 'ok'), 0) AS ok, COALESCE(SUM(status = 'error'), 0) AS error,
            COALESCE(SUM(status = 'denied'), 0) AS denied, COALESCE(SUM(status = 'denied' AND member = 0), 0) AS guestDenied,
            COALESCE(SUM(status = 'blocked'), 0) AS blocked, COALESCE(SUM(usd), 0) AS usd,
            COALESCE(SUM(CASE WHEN status = 'ok' THEN points END), 0) AS points,
            COALESCE(AVG(CASE WHEN status = 'ok' AND ms > 0 THEN ms END), 0) AS avgMs,
            COALESCE(SUM(status = 'ok' AND day = ?), 0) AS okToday
     FROM ai_log WHERE day >= ? AND day <= ?`,
    today,
    from,
    today,
  );
  const monthAi = get<{ ok: number; usd: number }>(
    "SELECT COALESCE(SUM(status = 'ok'), 0) AS ok, COALESCE(SUM(usd), 0) AS usd FROM ai_log WHERE created_at >= ?",
    month.start,
  );

  const perDay = new Map(range.map((day): [string, Overview['series'][number]] => [day, { day, ai: 0, errors: 0, signups: 0, actives: 0 }]));
  for (const r of all<{ day: string; ok: number; errors: number }>(
    "SELECT day, SUM(status = 'ok') AS ok, SUM(status = 'error') AS errors FROM ai_log WHERE day >= ? AND day <= ? GROUP BY day",
    from,
    today,
  )) {
    const p = perDay.get(r.day);
    if (p) Object.assign(p, { ai: r.ok, errors: r.errors });
  }
  for (const r of all<{ day: string; n: number }>('SELECT day, COUNT(*) AS n FROM actives WHERE day >= ? AND day <= ? GROUP BY day', from, today)) {
    const p = perDay.get(r.day);
    if (p) p.actives = r.n;
  }
  for (const s of signups) {
    const p = perDay.get(s.day);
    if (p) p.signups++;
  }

  const tools = new Map<string, ToolStat>();
  for (const r of all<{ tool: string; model: string; status: AiStatus; member: number; n: number; ms: number; usd: number }>(
    `SELECT tool, model, status, member, COUNT(*) AS n, SUM(CASE WHEN ms > 0 THEN ms ELSE 0 END) AS ms, SUM(usd) AS usd
     FROM ai_log WHERE day >= ? AND day <= ? GROUP BY tool, model, status, member`,
    from,
    today,
  )) {
    const t = tools.get(r.tool) ?? { tool: r.tool, ok: 0, error: 0, denied: 0, blocked: 0, members: 0, guests: 0, avgMs: 0, usd: 0, byModel: {} };
    t[r.status] += r.n;
    t.usd += r.usd;
    if (r.status === 'ok') {
      if (r.member) t.members += r.n;
      else t.guests += r.n;
      t.byModel[r.model] = (t.byModel[r.model] ?? 0) + r.n;
      // Running total of ms for now; divided below.
      t.avgMs += r.ms;
    }
    tools.set(r.tool, t);
  }
  const toolList = [...tools.values()]
    .map((t) => ({ ...t, avgMs: t.ok ? Math.round(t.avgMs / t.ok) : 0, usd: round2(t.usd) }))
    .sort((a, b) => b.ok - a.ok || b.error + b.denied + b.blocked - (a.error + a.denied + a.blocked));

  return {
    days,
    from,
    today,
    timeZone: timeZone(),
    resetLabel: dayLabel(month.end),
    users: {
      total: count('SELECT COUNT(*) AS n FROM users'),
      newInRange: signups.length,
      newToday: signups.filter((s) => s.day === today).length,
      locked: count('SELECT COUNT(*) AS n FROM users WHERE disabled = 1'),
      referred: signups.filter((s) => s.referred).length,
    },
    active: {
      today: count('SELECT COUNT(*) AS n FROM actives WHERE day = ?', today),
      inRange: count('SELECT COUNT(DISTINCT visitor) AS n FROM actives WHERE day >= ? AND day <= ?', from, today),
      members: count('SELECT COUNT(DISTINCT user_id) AS n FROM actives WHERE day >= ? AND day <= ? AND user_id IS NOT NULL', from, today),
    },
    ai: { ...ai, usd: round2(ai.usd), avgMs: Math.round(ai.avgMs), okMonth: monthAi.ok, usdMonth: round2(monthAi.usd) },
    series: [...perDay.values()],
    tools: toolList,
    models: all<{ model: string; ok: number; usd: number }>(
      "SELECT model, COUNT(*) AS ok, ROUND(SUM(usd), 2) AS usd FROM ai_log WHERE day >= ? AND day <= ? AND status = 'ok' GROUP BY model ORDER BY ok DESC",
      from,
      today,
    ),
    events: all<{ name: string; detail: string; n: number }>(
      'SELECT name, detail, SUM(n) AS n FROM events WHERE day >= ? AND day <= ? GROUP BY name, detail ORDER BY n DESC',
      from,
      today,
    ),
    errors: all<{ error: string; n: number; last: number }>(
      "SELECT error, COUNT(*) AS n, MAX(created_at) AS last FROM ai_log WHERE day >= ? AND day <= ? AND status = 'error' GROUP BY error ORDER BY n DESC LIMIT 20",
      from,
      today,
    ),
    rewards: all<{ reason: string; count: number; points: number }>(
      'SELECT reason, COUNT(*) AS count, SUM(points) AS points FROM bonus WHERE created_at >= ? AND created_at < ? GROUP BY reason ORDER BY points DESC',
      since,
      until,
    ),
    visits: all<{ source: string; n: number }>('SELECT source, COUNT(*) AS n FROM visits WHERE created_at >= ? AND created_at < ? GROUP BY source', since, until),
    topUsers: all<{ id: number; email: string; name: string; ai: number; usd: number }>(
      `SELECT u.id, u.email, u.name, COUNT(*) AS ai, ROUND(SUM(a.usd), 2) AS usd
       FROM ai_log a JOIN users u ON u.id = a.user_id
       WHERE a.day >= ? AND a.day <= ? AND a.status = 'ok' GROUP BY u.id ORDER BY ai DESC LIMIT 10`,
      from,
      today,
    ),
  };
}

/* ---------- Customers ---------- */

type UserBase = { id: number; email: string; name: string; created_at: number; disabled: number; ai: number; last_day: string | null; invited: number };

const USER_COLUMNS = `u.id, u.email, u.name, u.created_at, u.disabled,
  (SELECT COUNT(*) FROM ai_log a WHERE a.user_id = u.id AND a.status = 'ok') AS ai,
  (SELECT MAX(day) FROM actives x WHERE x.user_id = u.id) AS last_day,
  (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) AS invited`;

function toRow(u: UserBase): UserRow {
  const { monthly, bonus } = memberPoints(u.id);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.created_at,
    locked: !!u.disabled,
    admin: adminEmails().includes(u.email.toLowerCase()),
    ai: u.ai,
    lastDay: u.last_day,
    invited: u.invited,
    points: monthly + bonus,
    bonus,
  };
}

const ORDER: Record<UserSort, string> = {
  new: 'u.created_at DESC',
  ai: 'ai DESC, u.created_at DESC',
  active: 'last_day IS NULL, last_day DESC, u.created_at DESC',
};

export function listUsers(q: string, sort: UserSort, offset: number, limit = 30): UserList {
  const query = q.trim().slice(0, 100);
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = query ? "WHERE u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR u.ref_code = ?" : '';
  const args: SQLInputValue[] = query ? [like, like, query.toUpperCase()] : [];
  const total = count(`SELECT COUNT(*) AS n FROM users u ${where}`, ...args);
  const rows = all<UserBase>(`SELECT ${USER_COLUMNS} FROM users u ${where} ORDER BY ${ORDER[sort]} LIMIT ? OFFSET ?`, ...args, limit, offset);
  return { total, users: rows.map(toRow) };
}

export function userDetail(id: number): UserDetail | null {
  const base = get<(UserBase & { ref_code: string | null; referred_by: number | null }) | undefined>(
    `SELECT ${USER_COLUMNS}, u.ref_code, u.referred_by FROM users u WHERE u.id = ?`,
    id,
  );
  if (!base) return null;
  const inviter = base.referred_by ? get<{ id: number; email: string } | undefined>('SELECT id, email FROM users WHERE id = ?', base.referred_by) : undefined;
  const { monthly } = memberPoints(id);
  const totals = get<{ usd: number; errors: number }>(
    "SELECT COALESCE(SUM(usd), 0) AS usd, COALESCE(SUM(status = 'error'), 0) AS errors FROM ai_log WHERE user_id = ?",
    id,
  );
  return {
    user: {
      ...toRow(base),
      refCode: base.ref_code,
      invitedBy: inviter ?? null,
      sessions: count('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?', id, Date.now()),
    },
    monthly,
    spentThisMonth: count('SELECT SUM(points) AS n FROM usage WHERE user_id = ? AND period = ?', id, periodOf()),
    usd: round2(totals.usd),
    errors: totals.errors,
    tools: all<{ tool: string; n: number }>(
      "SELECT tool, COUNT(*) AS n FROM ai_log WHERE user_id = ? AND status = 'ok' GROUP BY tool ORDER BY n DESC",
      id,
    ),
    recentAi: all<{ at: number; tool: string; model: string; status: AiStatus; error: string; points: number; ms: number }>(
      'SELECT created_at AS at, tool, model, status, error, points, ms FROM ai_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 40',
      id,
    ),
    bonus: all<{ at: number; points: number; reason: string; ref: string }>(
      'SELECT created_at AS at, points, reason, ref FROM bonus WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      id,
    ),
    invited: all<{ id: number; email: string; createdAt: number }>(
      'SELECT id, email, created_at AS createdAt FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 50',
      id,
    ),
    activeDays: all<{ day: string }>('SELECT DISTINCT day FROM actives WHERE user_id = ? ORDER BY day DESC LIMIT 30', id).map((r) => r.day),
    adminLog: all<{ at: number; admin: string; action: string; detail: string }>(
      'SELECT created_at AS at, admin_email AS admin, action, detail FROM admin_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      id,
    ),
  };
}

export class AdminError extends Error {}

/** Records an admin change (userId: the customer concerned, or null for settings). */
export const audit = (admin: AccountUser, action: string, userId: number | null, detail: string) =>
  db().prepare('INSERT INTO admin_log (created_at, admin_email, action, user_id, detail) VALUES (?, ?, ?, ?, ?)').run(Date.now(), admin.email, action, userId, detail);

export const MAX_GRANT = 1000;

/** Gives a customer bonus points (e.g. to make up for a failed result). They never expire, like other bonus points. */
export function grantBonus(admin: AccountUser, userId: number, points: unknown, note: unknown) {
  if (!Number.isInteger(points) || (points as number) < 1 || (points as number) > MAX_GRANT) {
    throw new AdminError(`Số điểm phải là số nguyên từ 1 đến ${MAX_GRANT}.`);
  }
  if (!get('SELECT 1 AS x FROM users WHERE id = ?', userId)) throw new AdminError('Không tìm thấy tài khoản.');
  const reason = typeof note === 'string' ? note.trim().slice(0, 100) : '';
  db()
    .prepare("INSERT INTO bonus (user_id, points, reason, ref, period, created_at) VALUES (?, ?, 'admin', ?, ?, ?)")
    .run(userId, points as number, reason, periodOf(), Date.now());
  audit(admin, 'bonus', userId, `+${points} điểm${reason ? ` · ${reason}` : ''}`);
}

/** Locks (signs out everywhere, blocks sign-in and invite rewards) or unlocks an account. */
export function setLocked(admin: AccountUser, userId: number, locked: boolean) {
  const u = get<{ email: string } | undefined>('SELECT email FROM users WHERE id = ?', userId);
  if (!u) throw new AdminError('Không tìm thấy tài khoản.');
  if (locked && adminEmails().includes(u.email.toLowerCase())) throw new AdminError('Không thể khóa tài khoản quản trị.');
  db().prepare('UPDATE users SET disabled = ? WHERE id = ?').run(locked ? 1 : 0, userId);
  if (locked) db().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  audit(admin, locked ? 'lock' : 'unlock', userId, locked ? 'Khóa tài khoản' : 'Mở khóa tài khoản');
}

/* ---------- Server and settings ---------- */

const fileMb = (f: string) => (existsSync(f) ? statSync(f).size / 1_048_576 : 0);

export function systemInfo(): SystemInfo {
  const file = dbFile();
  const tables = Object.fromEntries(
    ['users', 'sessions', 'usage', 'bonus', 'visits', 'ai_log', 'actives', 'events', 'admin_log'].map((t) => [t, count(`SELECT COUNT(*) AS n FROM ${t}`)]),
  );
  const sources = aiSourceSummary();
  const secret = process.env.CAMI_SECRET ?? '';
  const shareUrl = process.env.EXPO_PUBLIC_SHARE_URL ?? '';
  const defaultModel = process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const checks: Check[] = [
    {
      label: 'Nguồn AI',
      ok: sources.vertex + sources.studio > 0,
      value: `${sources.vertex + sources.studio}/${sources.total} nguồn dùng được (${sources.vertex} Vertex AI · ${sources.studio} AI Studio)`,
      hint: 'Thêm hoặc bật lại nguồn ở tab Cài đặt (nguồn đang tắt, hết credit hoặc khoá lỗi không được tính).',
    },
    {
      label: 'Model mặc định',
      ok: imageModels.some((m) => m.id === defaultModel),
      value: defaultModel,
      hint: 'GEMINI_IMAGE_MODEL nên là một trong các model của app.',
    },
    {
      label: 'Claude (viết blog)',
      ok: hasClaude(),
      value: hasClaude() ? 'Đã đặt CAMI_CLAUDE_API_KEY' : 'Chưa đặt CAMI_CLAUDE_API_KEY',
      hint: 'Khoá từ console.anthropic.com, dùng để AI viết bài blog. Chưa có thì chọn model Gemini Flash trong tab Blog.',
    },
    {
      label: 'CAMI_SECRET',
      ok: secret.length >= 16,
      value: secret ? `Đã đặt (${secret.length} ký tự)` : 'Chưa đặt — đang dùng chuỗi mặc định',
      hint: 'Đặt một chuỗi ngẫu nhiên dài ≥ 16 ký tự trước khi chạy thật (dùng để băm IP và mã máy).',
    },
    {
      label: 'APP_TOKEN',
      ok: !!process.env.APP_TOKEN,
      value: process.env.APP_TOKEN ? 'Đã đặt' : 'Chưa đặt',
      hint: 'Không bắt buộc. Chặn bớt người lạ gọi thẳng API AI (cần trùng EXPO_PUBLIC_APP_TOKEN).',
    },
    {
      label: 'Link chia sẻ',
      ok: /^https:\/\//.test(shareUrl),
      value: shareUrl || 'Chưa đặt EXPO_PUBLIC_SHARE_URL',
      hint: 'Địa chỉ web công khai dùng trong link mời bạn bè và chia sẻ Facebook.',
    },
    {
      label: 'Quản trị viên',
      ok: adminEmails().length > 0,
      value: `${adminEmails().length} email trong ADMIN_EMAILS`,
    },
    {
      label: 'Nơi lưu dữ liệu',
      ok: !!process.env.CAMI_DATA_DIR || process.env.NODE_ENV !== 'production',
      value: file,
      hint: 'Khi chạy thật nên đặt CAMI_DATA_DIR ra thư mục được sao lưu thường xuyên.',
    },
  ];
  const month = monthWindow();
  const rewardPoints = getRewardPoints();
  const plan = getPlan();
  return {
    now: Date.now(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1_048_576),
    schema: SCHEMA,
    db: { file, sizeMb: round2(fileMb(file) + fileMb(`${file}-wal`)), tables },
    config: {
      models: imageModels.map((m) => ({ id: m.id, name: m.name, usd: m.usd, points: plan.modelPoints[m.id] ?? m.points, isDefault: m.id === defaultModel })),
      guestFreeTries: plan.guestFreeTries,
      monthlyPoints: plan.monthlyPoints,
      referralInviter: rewardPoints.inviter,
      referralFriend: rewardPoints.friend,
      maxReferralsPerMonth: rewardPoints.maxPerMonth,
      sharePoints: rewardPoints.share,
      timeZone: timeZone(),
      period: periodOf(),
      resetLabel: dayLabel(month.end),
    },
    checks,
  };
}

/* ---------- AI sources (Settings tab) ---------- */

/** The AI sources as the admin page shows them: no secrets, plus credit, cooldown and broken keys. */
export function aiSettings(): AiSettings {
  const view = storedView();
  const runtime = new Map(getAiSources().sources.map((r) => [r.id, r]));
  return {
    origin: view.origin,
    location: view.location,
    updatedAt: view.updatedAt,
    secretReady: (process.env.CAMI_SECRET ?? '').length >= 16,
    sources: view.sources.map((s) => ({
      ...s,
      creditState: s.credit ? creditState(s.id, s.credit) : null,
      retryInSeconds: retryIn(s.id),
      ...(runtime.get(s.id)?.broken && { broken: runtime.get(s.id)!.broken }),
    })),
  };
}
