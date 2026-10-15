import { createHash, randomBytes } from 'node:crypto';

import { pointsFor, type AccountUser, type Credits } from '../ai/credits';
import { DEFAULT_IMAGE_MODEL } from '../ai/models';
import type { MessageKey, Params } from '../i18n/core';
import { isAdmin } from './admins';
import { db } from './db';
import { hashPassword, verifyPassword } from './password';
import { allowanceFor, getPlan, rememberAllowance } from './plan';
import { applyReferral, normalizeCode, refCodeOf } from './rewards';
import { dayLabel, monthWindow, periodOf } from './time';

/**
 * Accounts and AI credits, enforced on the server (the app only displays them).
 * - The app sends a session token (Authorization: Bearer …) once signed in, and always a random device id.
 * - Guests get a few free results per device; a hashed IP caps how often clearing app data can reset that.
 * - Members get monthly points per calendar month (CAMI_TIMEZONE, Argentina/Brazil by default); Pro costs more points than Flash.
 * The numbers come from the plan set on the admin page (plan.ts).
 * Only hashes of session tokens and IPs are stored, so a leaked database file can't be replayed.
 */

const SESSION_DAYS = 90;
/** Clearing app data gives a new device id; past this many times the free tries per IP in 30 days, guests must sign up. */
const GUEST_IP_FACTOR = 3;
const GUEST_IP_WINDOW = 30 * 86_400_000;
/** New accounts per IP per day (each account brings a fresh monthly allowance). */
const SIGNUPS_PER_IP_PER_DAY = 3;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const secret = () => process.env.CAMI_SECRET ?? 'cami-dev-secret';

type UserRow = { id: number; email: string; name: string; password_hash: string; disabled: number };
const toUser = (u: Pick<UserRow, 'id' | 'email' | 'name'>): AccountUser => ({ id: u.id, email: u.email, name: u.name });

/* ---------- Who is calling ---------- */

export type Caller = { user: AccountUser | null; device: string | null; ip: string };

function clientIp(request: Request) {
  // Behind nginx (proxy_set_header X-Real-IP $remote_addr), X-Real-IP is set by the proxy and can't be forged.
  // Otherwise use the LAST X-Forwarded-For entry: earlier ones come from the client and are easy to fake.
  const raw = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'local';
  return sha256(`${secret()}|ip|${raw}`).slice(0, 32);
}

const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+([\w-]{20,100})$/)?.[1] ?? null;

export function caller(request: Request): Caller {
  const device = request.headers.get('x-cami-device');
  return {
    user: userFromToken(bearer(request)),
    device: device && /^[\w-]{16,64}$/.test(device) ? device : null,
    ip: clientIp(request),
  };
}

function userFromToken(token: string | null): AccountUser | null {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
    )
    .get(sha256(token), Date.now()) as Pick<UserRow, 'id' | 'email' | 'name'> | undefined;
  return row ? toUser(row) : null;
}

function createSession(userId: number, c: Caller) {
  const token = randomBytes(32).toString('base64url');
  const d = db();
  d.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  d.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, ip, device) VALUES (?, ?, ?, ?, ?)').run(
    sha256(token),
    userId,
    Date.now() + SESSION_DAYS * 86_400_000,
    c.ip,
    c.device ?? '',
  );
  return token;
}

export function endSession(request: Request) {
  const token = bearer(request);
  if (token) db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

/* ---------- Credits ---------- */

function guestUsed(device: string | null, ip: string, tries: number) {
  const d = db();
  const byIp = (d.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id IS NULL AND ip = ? AND created_at >= ?').get(ip, Date.now() - GUEST_IP_WINDOW) as { n: number }).n;
  if (byIp >= tries * GUEST_IP_FACTOR) return tries;
  // Without a device id (old app / blocked storage) the IP stands in for it.
  const byDevice = device
    ? (d.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id IS NULL AND device = ?').get(device) as { n: number }).n
    : byIp;
  return Math.min(tries, byDevice);
}

/**
 * A member's points: what is left of this month's allowance, plus bonus points not yet used.
 * Each month the allowance (as it was that month) is spent first; anything beyond it came out of the bonus.
 */
export function memberPoints(userId: number) {
  const d = db();
  const now = periodOf();
  const months = d.prepare('SELECT period, SUM(points) AS n FROM usage WHERE user_id = ? GROUP BY period').all(userId) as { period: string; n: number }[];
  const spentNow = months.find((m) => m.period === now)?.n ?? 0;
  const overage = months.reduce((sum, m) => sum + Math.max(0, m.n - allowanceFor(m.period)), 0);
  const earned = (d.prepare('SELECT COALESCE(SUM(points), 0) AS n FROM bonus WHERE user_id = ?').get(userId) as { n: number }).n;
  return { monthly: Math.max(0, allowanceFor(now) - spentNow), bonus: Math.max(0, earned - overage) };
}

export function creditsOf(c: Caller): Credits {
  if (!c.user) {
    const tries = getPlan().guestFreeTries;
    return { kind: 'guest', left: Math.max(0, tries - guestUsed(c.device, c.ip, tries)), limit: tries };
  }
  const { end } = monthWindow();
  const { monthly, bonus } = memberPoints(c.user.id);
  return {
    kind: 'member',
    left: monthly + bonus,
    limit: allowanceFor(periodOf()),
    bonus,
    resetAt: end,
    resetLabel: dayLabel(end),
    ...(isAdmin(c.user) && { unlimited: true }),
  };
}

/** `key`/`params`: the message, translated by the API route. */
export type Denied = { status: number; code: 'login_required' | 'no_points'; key: MessageKey; params: Params };

/**
 * Reserves the cost of one AI result before calling the model, so parallel requests can't overspend.
 * Checking and inserting happen in the same synchronous step (one SQLite connection, no await in between).
 * Call `settle` after success (the model actually used may be cheaper) or `refund` after a failure.
 */
export function charge(c: Caller, model: string): { usageId: number } | Denied {
  const plan = getPlan();
  // This month's allowance is fixed the first time it is used.
  if (c.user) rememberAllowance();
  const credits = creditsOf(c);
  const cost = c.user ? pointsFor(plan, model) : 1;
  // Admins (ADMIN_EMAILS) are never stopped; their use is still recorded for the statistics.
  if (credits.left < cost && !(credits.kind === 'member' && credits.unlimited)) {
    if (credits.kind === 'guest') {
      return { status: 401, code: 'login_required', key: 'server.guestOut', params: { tries: plan.guestFreeTries, points: plan.monthlyPoints } };
    }
    const day = credits.resetLabel;
    return credits.left > 0
      ? { status: 402, code: 'no_points', key: 'server.notEnoughPoints', params: { left: credits.left, cost, day, flash: pointsFor(plan, DEFAULT_IMAGE_MODEL) } }
      : { status: 402, code: 'no_points', key: 'server.outOfPoints', params: { day } };
  }
  const id = db()
    .prepare('INSERT INTO usage (user_id, device, ip, model, points, created_at, period) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(c.user?.id ?? null, c.user ? null : c.device, c.ip, model, cost, Date.now(), periodOf()).lastInsertRowid;
  return { usageId: Number(id) };
}

export const isDenied = (r: { usageId: number } | Denied): r is Denied => 'code' in r;

/** Records the model that actually answered (a busy Pro falls back to Flash, which costs members fewer points). */
export function settle(usageId: number, model: string, isMember: boolean) {
  db().prepare('UPDATE usage SET model = ?, points = ? WHERE id = ?').run(model, isMember ? pointsFor(getPlan(), model) : 1, usageId);
}

export function refund(usageId: number) {
  db().prepare('DELETE FROM usage WHERE id = ?').run(usageId);
}

/* ---------- Sign up / sign in ---------- */

/** `key` is the user-facing message, translated by the API route into the caller's language. */
export class AccountError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly status = 400,
  ) {
    super(key);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Failed sign-ins per IP, kept in memory: enough to slow down password guessing. */
const failures = new Map<string, { n: number; until: number }>();
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60_000;

export async function register(c: Caller, input: { email?: unknown; password?: unknown; name?: unknown; ref?: unknown }) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
  if (!EMAIL_RE.test(email) || email.length > 120) throw new AccountError('server.emailInvalid');
  if (password.length < 6 || password.length > 128) throw new AccountError('server.passwordShort');

  const d = db();
  if (d.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new AccountError('server.emailTaken', 409);
  const recent = (d.prepare('SELECT COUNT(*) AS n FROM users WHERE ip = ? AND created_at >= ?').get(c.ip, Date.now() - 86_400_000) as { n: number }).n;
  if (recent >= SIGNUPS_PER_IP_PER_DAY) throw new AccountError('server.tooManySignups', 429);
  // A mistyped invite code is reported before the account exists, so the friend can fix it.
  const ref = normalizeCode(input.ref);
  if (ref && !d.prepare('SELECT 1 FROM users WHERE ref_code = ?').get(ref)) throw new AccountError('server.badRefCode');

  const hash = await hashPassword(password);
  const id = Number(
    d.prepare('INSERT INTO users (email, name, password_hash, created_at, ip) VALUES (?, ?, ?, ?, ?)').run(email, name, hash, Date.now(), c.ip).lastInsertRowid,
  );
  refCodeOf(id);
  const referralBonus = applyReferral(id, ref, c.ip);
  const user: AccountUser = { id, email, name };
  return { token: createSession(id, c), user, credits: creditsOf({ ...c, user }), referralBonus };
}

export async function login(c: Caller, input: { email?: unknown; password?: unknown }) {
  const lock = failures.get(c.ip);
  if (lock && lock.n >= MAX_FAILURES && lock.until > Date.now()) throw new AccountError('server.tooManyAttempts', 429);

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const row = db().prepare('SELECT id, email, name, password_hash, disabled FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    const f = lock && lock.until > Date.now() ? lock : { n: 0, until: 0 };
    failures.set(c.ip, { n: f.n + 1, until: Date.now() + LOCK_MS });
    throw new AccountError('server.wrongLogin', 401);
  }
  if (row.disabled) throw new AccountError('server.accountLocked', 403);
  failures.delete(c.ip);
  const user = toUser(row);
  return { token: createSession(row.id, c), user, credits: creditsOf({ ...c, user }) };
}

/** Deletes the account and everything tied to it (App Store requires in-app account deletion). */
export async function deleteAccount(c: Caller, password: unknown) {
  if (!c.user) throw new AccountError('server.notSignedIn', 401);
  const row = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(c.user.id) as Pick<UserRow, 'password_hash'> | undefined;
  if (!row || typeof password !== 'string' || !(await verifyPassword(password, row.password_hash))) {
    throw new AccountError('server.wrongPassword', 401);
  }
  db().prepare('DELETE FROM users WHERE id = ?').run(c.user.id);
}
