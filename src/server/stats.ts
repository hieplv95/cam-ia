import { eventDetail, isTrackedEvent } from '../admin/events';
import type { AiStatus } from '../admin/types';
import { modelInfo } from '../ai/models';
import type { Caller } from './account';
import { db } from './db';
import { dayOf } from './time';

/**
 * Usage statistics for the admin dashboard. Recording never gets in the way of the app:
 * any failure here is logged and ignored.
 */

/** Marks the caller as active today (one row per device, or per hashed IP without a device id). */
export function markActive(c: Caller) {
  db()
    .prepare(
      `INSERT INTO actives (day, visitor, user_id) VALUES (?, ?, ?)
       ON CONFLICT (day, visitor) DO UPDATE SET user_id = COALESCE(excluded.user_id, user_id)`,
    )
    .run(dayOf(), c.device ?? `ip:${c.ip}`, c.user?.id ?? null);
}

/**
 * One AI request. `source` is the AI source that answered (its credit goes down). `tool` names the feature ('generate', 'prompt', 'preset.<id>', 'studio.<id>');
 * `error` is the message key of a failure, or why the request was refused.
 */
export function logAi(c: Caller, entry: { tool: string; model: string; status: AiStatus; error?: string; ms?: number; points?: number; source?: string }) {
  try {
    const now = Date.now();
    // Only results are billed by Google; refused and failed requests cost nothing.
    const usd = entry.status === 'ok' ? (modelInfo(entry.model)?.usd ?? 0) : 0;
    db()
      .prepare(
        `INSERT INTO ai_log (created_at, day, user_id, member, tool, model, status, error, ms, points, usd, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(now, dayOf(now), c.user?.id ?? null, c.user ? 1 : 0, entry.tool, entry.model, entry.status, entry.error ?? '', Math.round(entry.ms ?? 0), entry.points ?? 0, usd, entry.source ?? '');
    markActive(c);
  } catch (e) {
    console.error('[stats] ai log failed', e);
  }
}

/** Events per IP per hour: enough for real use, while a script can't inflate the numbers much. */
const MAX_EVENTS_PER_HOUR = 300;
const budget = new Map<string, { n: number; until: number }>();

/** Counts one use of a feature that runs on the phone. Returns false when the event is unknown or over the limit. */
export function track(c: Caller, name: unknown, detail: unknown) {
  if (!isTrackedEvent(name)) return false;
  const now = Date.now();
  if (budget.size > 10_000) for (const [k, v] of budget) if (v.until < now) budget.delete(k);
  const b = budget.get(c.ip);
  const current = b && b.until > now ? b : { n: 0, until: now + 3_600_000 };
  if (current.n >= MAX_EVENTS_PER_HOUR) return false;
  budget.set(c.ip, { ...current, n: current.n + 1 });
  try {
    db()
      .prepare('INSERT INTO events (day, name, detail, n) VALUES (?, ?, ?, 1) ON CONFLICT (day, name, detail) DO UPDATE SET n = n + 1')
      .run(dayOf(now), name, eventDetail(name, detail));
    if (name === 'app_open') markActive(c);
  } catch (e) {
    console.error('[stats] track failed', e);
  }
  return true;
}
