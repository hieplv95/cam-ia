import { randomInt } from 'node:crypto';

import { DEFAULT_REWARD_POINTS, MAX_REWARD_POINTS, sharePlatforms, type RewardPoints, type Rewards, type SharePlatform } from '../ai/credits';
import { db, getSetting, setSetting } from './db';
import { periodOf } from './time';

/**
 * Bonus points for inviting friends and for sharing Cami.
 * - Invites: a friend who signs up with your code gives you `inviter` points (up to `maxPerMonth` invites a
 *   month) and the friend `friend` points. Nothing is given when both sign up from the same network, so people
 *   can't invite themselves.
 * - Shares: Facebook never tells an app whether a post was really made, so the bonus comes from the result
 *   instead: `share` points (once a month) when someone else opens the link the user shared on Facebook
 *   (tagged &s=fb). A visit from the owner's own networks or devices, or while signed in as the owner, doesn't count.
 * The amounts are set on the admin page (getRewardPoints); 0 turns that reward off.
 */

const REWARDS_KEY = 'reward_points';

export function getRewardPoints(): RewardPoints {
  const raw = getSetting(REWARDS_KEY);
  return raw ? { ...DEFAULT_REWARD_POINTS, ...(JSON.parse(raw) as Partial<RewardPoints>) } : DEFAULT_REWARD_POINTS;
}

export class RewardSettingsError extends Error {}

/** Saves the amounts typed on the admin page (whole numbers from 0 to MAX_REWARD_POINTS). */
export function setRewardPoints(input: unknown): RewardPoints {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const next = { ...getRewardPoints() };
  for (const k of Object.keys(DEFAULT_REWARD_POINTS) as (keyof RewardPoints)[]) {
    if (o[k] === undefined) continue;
    const n = Number(o[k]);
    const max = k === 'maxPerMonth' ? 100 : MAX_REWARD_POINTS;
    if (!Number.isInteger(n) || n < 0 || n > max) throw new RewardSettingsError(`Giá trị phải là số nguyên từ 0 đến ${max}.`);
    next[k] = n;
  }
  setSetting(REWARDS_KEY, JSON.stringify(next));
  return next;
}

// No 0/O or 1/I/L, so a code read out loud or typed by hand is unambiguous.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

/** The user's invite code, created the first time it is needed. */
export function refCodeOf(userId: number) {
  const d = db();
  const row = d.prepare('SELECT ref_code FROM users WHERE id = ?').get(userId) as { ref_code: string | null } | undefined;
  if (row?.ref_code) return row.ref_code;
  for (;;) {
    const code = newCode();
    try {
      d.prepare('UPDATE users SET ref_code = ? WHERE id = ?').run(code, userId);
      return code;
    } catch {
      // Same code already taken (unique index): try another.
    }
  }
}

export const normalizeCode = (v: unknown) =>
  typeof v === 'string'
    ? v
        .toUpperCase()
        .replace(/^CAMI-?/, '')
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12)
    : '';

function addBonus(userId: number, points: number, reason: 'referral' | 'referred' | 'share', ref: string) {
  db().prepare('INSERT INTO bonus (user_id, points, reason, ref, period, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, points, reason, ref, periodOf(), Date.now());
}

/**
 * Links a new account to whoever invited it and gives both their bonus.
 * Returns the points the new user received (0 when the code is unknown or comes from the same network).
 */
export function applyReferral(newUserId: number, code: string, ip: string) {
  if (!code) return 0;
  const d = db();
  const inviter = d.prepare('SELECT id, ip, disabled FROM users WHERE ref_code = ?').get(code) as { id: number; ip: string; disabled: number } | undefined;
  if (!inviter || inviter.id === newUserId || inviter.disabled) return 0;
  d.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(inviter.id, newUserId);
  if (inviter.ip === ip) return 0;

  const points = getRewardPoints();
  const thisMonth = (d.prepare("SELECT COUNT(*) AS n FROM bonus WHERE user_id = ? AND reason = 'referral' AND period = ?").get(inviter.id, periodOf()) as { n: number }).n;
  if (points.inviter > 0 && thisMonth < points.maxPerMonth) addBonus(inviter.id, points.inviter, 'referral', String(newUserId));
  if (points.friend > 0) addBonus(newUserId, points.friend, 'referred', String(inviter.id));
  return points.friend;
}

export function rewardsOf(userId: number): Rewards {
  const d = db();
  const points = getRewardPoints();
  const period = periodOf();
  const invited = (d.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?').get(userId) as { n: number }).n;
  const referral = d
    .prepare("SELECT COALESCE(SUM(points), 0) AS points, COALESCE(SUM(period = ?), 0) AS thisMonth FROM bonus WHERE user_id = ? AND reason = 'referral'")
    .get(period, userId) as { points: number; thisMonth: number };
  const shared = new Set(
    (d.prepare("SELECT ref FROM bonus WHERE user_id = ? AND reason = 'share' AND period = ?").all(userId, period) as { ref: string }[]).map((r) => r.ref),
  );
  const shareVisits = (d.prepare("SELECT COUNT(*) AS n FROM visits WHERE owner_id = ? AND period = ? AND source = 'fb'").get(userId, period) as { n: number }).n;
  return {
    code: refCodeOf(userId),
    invited,
    referralPoints: referral.points,
    invitesLeftThisMonth: Math.max(0, points.maxPerMonth - referral.thisMonth),
    shared: Object.fromEntries(sharePlatforms.map((p) => [p, shared.has(p)])) as Record<SharePlatform, boolean>,
    shareVisits,
    points,
  };
}

const SOURCES: Record<string, SharePlatform> = { fb: 'facebook' };

/** Whether this visitor is the link's owner: same account, a device they signed in on, or a network they used. */
function isOwner(ownerId: number, visitor: { userId: number | null; device: string | null; ip: string }) {
  if (visitor.userId === ownerId) return true;
  const d = db();
  const seen = d
    .prepare(
      `SELECT 1 FROM users WHERE id = ? AND ip = ?
       UNION SELECT 1 FROM sessions WHERE user_id = ? AND (ip = ? OR (device <> '' AND device = ?))
       UNION SELECT 1 FROM usage WHERE user_id = ? AND ip = ?
       LIMIT 1`,
    )
    .get(ownerId, visitor.ip, ownerId, visitor.ip, visitor.device ?? '', ownerId, visitor.ip);
  return !!seen;
}

/**
 * Someone opened a shared link (?ref=CODE, plus &s=fb when it was shared on Facebook).
 * Each visitor is counted once a month; the first one from outside the owner's own devices and networks
 * earns the owner the share bonus for that month. Returns nothing: visitors don't learn about the owner.
 */
export function recordVisit(code: string, source: string, visitor: { userId: number | null; device: string | null; ip: string }) {
  const d = db();
  const owner = d.prepare('SELECT id FROM users WHERE ref_code = ? AND disabled = 0').get(code) as { id: number } | undefined;
  if (!owner || isOwner(owner.id, visitor)) return;

  const src = source in SOURCES ? source : 'link';
  const period = periodOf();
  const counted = d
    .prepare('SELECT 1 FROM visits WHERE owner_id = ? AND source = ? AND period = ? AND (ip = ? OR (device IS NOT NULL AND device = ?))')
    .get(owner.id, src, period, visitor.ip, visitor.device ?? '');
  if (counted) return;
  d.prepare('INSERT INTO visits (owner_id, source, device, ip, period, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(owner.id, src, visitor.device, visitor.ip, period, Date.now());

  const platform = SOURCES[src];
  if (!platform) return;
  const rewarded = d.prepare("SELECT 1 FROM bonus WHERE user_id = ? AND reason = 'share' AND ref = ? AND period = ?").get(owner.id, platform, period);
  const share = getRewardPoints().share;
  if (!rewarded && share > 0) addBonus(owner.id, share, 'share', platform);
}
