import type { SQLInputValue } from 'node:sqlite';

import { HEARTBEAT_MS, ONLINE_MS, PLATFORMS, screenOf, VISIT_GAP_MS } from '../admin/presence';
import type { OnlineNow, Traffic, TrafficPeriod, TrafficPoint, TrafficSummary } from '../admin/types';
import type { Caller } from './account';
import { db } from './db';
import { markActive } from './stats';
import { addDays, dayOf, hourOf, mondayOf, startOfDay, timeZone } from './time';

/**
 * Who is online and how people use the app over time, from a heartbeat the app sends every HEARTBEAT_MS
 * while it is on screen. Only a device id (or hashed IP), the platform and the current screen are kept.
 */

/** Heartbeats closer together than this from the same visitor are ignored (a reload, two tabs). */
const MIN_BEAT_MS = 15_000;
/** Heartbeats per IP per hour: several devices on one network, but a script can't fake a crowd. */
const MAX_BEATS_PER_HOUR = 1_200;
const budget = new Map<string, { n: number; until: number }>();

const get = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).get(...args) as T | undefined;
const all = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).all(...args) as T[];
const run = (sql: string, ...args: SQLInputValue[]) => db().prepare(sql).run(...args);

/** Records one "still here" from the app. Returns false when refused (over the limit). */
export function heartbeat(c: Caller, body: { platform?: unknown; screen?: unknown }) {
  const now = Date.now();
  if (budget.size > 10_000) for (const [k, v] of budget) if (v.until < now) budget.delete(k);
  const b = budget.get(c.ip);
  const current = b && b.until > now ? b : { n: 0, until: now + 3_600_000 };
  if (current.n >= MAX_BEATS_PER_HOUR) return false;
  budget.set(c.ip, { ...current, n: current.n + 1 });

  try {
    const visitor = c.device ?? `ip:${c.ip}`;
    const userId = c.user?.id ?? null;
    const platform = typeof body.platform === 'string' && body.platform in PLATFORMS ? body.platform : '';
    const screen = screenOf(body.screen);
    const seen = get<{ last_seen: number; visit_id: number }>('SELECT last_seen, visit_id FROM presence WHERE visitor = ?', visitor);
    if (seen && now - seen.last_seen < MIN_BEAT_MS) return true;

    let visitId: number;
    if (seen && now - seen.last_seen <= VISIT_GAP_MS) {
      visitId = seen.visit_id;
      run('UPDATE app_visits SET last_seen = ?, user_id = COALESCE(?, user_id), platform = ? WHERE id = ?', now, userId, platform, visitId);
    } else {
      visitId = Number(run('INSERT INTO app_visits (visitor, user_id, platform, started_at, last_seen) VALUES (?, ?, ?, ?, ?)', visitor, userId, platform, now, now).lastInsertRowid);
    }
    run(
      `INSERT INTO presence (visitor, user_id, platform, screen, first_seen, last_seen, visit_id) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (visitor) DO UPDATE SET user_id = COALESCE(excluded.user_id, user_id), platform = excluded.platform,
         screen = excluded.screen, last_seen = excluded.last_seen, visit_id = excluded.visit_id`,
      visitor,
      userId,
      platform,
      screen,
      now,
      now,
      visitId,
    );
    const day = dayOf(now);
    run('INSERT INTO screen_time (day, screen, beats) VALUES (?, ?, 1) ON CONFLICT (day, screen) DO UPDATE SET beats = beats + 1', day, screen);
    const online = get<{ n: number }>('SELECT COUNT(*) AS n FROM presence WHERE last_seen >= ?', now - ONLINE_MS)?.n ?? 0;
    // Both SET expressions read the old peak, so peak_at moves only when the record is beaten.
    run(
      `INSERT INTO online_hours (day, hour, peak, peak_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (day, hour) DO UPDATE SET peak_at = CASE WHEN excluded.peak > peak THEN excluded.peak_at ELSE peak_at END,
         peak = MAX(peak, excluded.peak)`,
      day,
      hourOf(now),
      online,
      now,
    );
    markActive(c);
  } catch (e) {
    console.error('[presence] heartbeat failed', e);
  }
  return true;
}

/* ---------- Admin report ---------- */

type VisitRow = { visitor: string; user_id: number | null; platform: string; started_at: number; last_seen: number };

/** A visit's time on screen: from its first heartbeat to half an interval after its last one. */
const visitEnd = (v: VisitRow) => v.last_seen + HEARTBEAT_MS / 2;

const visitsIn = (start: number, end: number) =>
  all<VisitRow>('SELECT visitor, user_id, platform, started_at, last_seen FROM app_visits WHERE started_at < ? AND last_seen >= ?', end, start - HEARTBEAT_MS);

function summarize(start: number, end: number): TrafficSummary {
  const visits = visitsIn(start, end).filter((v) => visitEnd(v) > start);
  const users = new Set<string>();
  const memberIds = new Set<number>();
  const memberVisitors = new Set<string>();
  let seconds = 0;
  let started = 0;
  for (const v of visits) {
    users.add(v.visitor);
    if (v.user_id !== null) {
      memberIds.add(v.user_id);
      memberVisitors.add(v.visitor);
    }
    if (v.started_at >= start) started++;
    seconds += Math.max(0, Math.min(visitEnd(v), end) - Math.max(v.started_at, start)) / 1000;
  }
  const newUsers = get<{ n: number }>('SELECT COUNT(*) AS n FROM presence WHERE first_seen >= ? AND first_seen < ?', start, end)?.n ?? 0;
  const peakRow = peakIn(start, end);
  return {
    users: users.size,
    members: memberIds.size,
    guests: [...users].filter((u) => !memberVisitors.has(u)).length,
    newUsers,
    visits: started,
    seconds: Math.round(seconds),
    peak: peakRow?.peak ?? 0,
    peakAt: peakRow?.peak_at ?? null,
  };
}

/** Most people online at once in [start, end), from the hourly records. */
function peakIn(start: number, end: number) {
  const rows = all<{ peak: number; peak_at: number }>(
    'SELECT peak, peak_at FROM online_hours WHERE day >= ? AND day <= ? ORDER BY peak DESC, peak_at ASC',
    dayOf(start),
    dayOf(end - 1),
  );
  return rows.find((r) => r.peak_at >= start && r.peak_at < end) ?? null;
}

/** Longest custom range, in days. */
export const MAX_RANGE_DAYS = 366;

/** A custom range of days ("2026-10-01" … "2026-10-11"), or an error message in Vietnamese for the admin. */
export function customRange(from: string | null, to: string | null, now = Date.now()): { from: string; to: string } | string {
  const valid = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;
  if (!valid(from) || !valid(to)) return 'Ngày không hợp lệ.';
  if (from > to) return 'Ngày bắt đầu phải trước ngày kết thúc.';
  if (to > dayOf(now)) return 'Ngày kết thúc không được sau hôm nay.';
  if (Date.parse(to) - Date.parse(from) >= MAX_RANGE_DAYS * 86_400_000) return `Chọn tối đa ${MAX_RANGE_DAYS} ngày.`;
  return { from, to };
}

/** The chosen period and the same stretch of time just before it, to compare with. */
function windowOf(period: TrafficPeriod, now: number, range?: { from: string; to: string }) {
  const today = dayOf(now);
  const todayStart = startOfDay(today);
  if (period === 'custom' && range) {
    const start = startOfDay(range.from);
    const end = Math.min(startOfDay(addDays(range.to, 1)), now);
    const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) + 1;
    return { from: range.from, to: range.to, start, end, prevStart: start - (end - start), prevEnd: start, compareLabel: days === 1 ? 'ngày trước đó' : `${days} ngày trước đó` };
  }
  if (period === 'yesterday') {
    const y = addDays(today, -1);
    const start = startOfDay(y);
    return { from: y, to: y, start, end: todayStart, prevStart: startOfDay(addDays(y, -1)), prevEnd: start, compareLabel: 'hôm kia' };
  }
  if (period === 'week') {
    const monday = mondayOf(today);
    const start = startOfDay(monday);
    const prevStart = startOfDay(addDays(monday, -7));
    return { from: monday, to: addDays(monday, 6), start, end: now, prevStart, prevEnd: Math.min(start, prevStart + (now - start)), compareLabel: 'tuần trước cùng thời điểm' };
  }
  if (period === 'month') {
    const first = `${today.slice(0, 8)}01`;
    const start = startOfDay(first);
    const prevFirst = addDays(first, -1).slice(0, 8) + '01';
    const prevStart = startOfDay(prevFirst);
    const last = addDays(`${addDays(first, 32).slice(0, 8)}01`, -1);
    return { from: first, to: last, start, end: now, prevStart, prevEnd: Math.min(start, prevStart + (now - start)), compareLabel: 'tháng trước cùng thời điểm' };
  }
  const prevStart = startOfDay(addDays(today, -1));
  return { from: today, to: today, start: todayStart, end: now, prevStart, prevEnd: prevStart + (now - todayStart), compareLabel: 'hôm qua cùng giờ' };
}

/** Each visit split into the (day, hour) slots it covers, clipped to [start, end). */
function slots(visits: VisitRow[], start: number, end: number, each: (day: string, hour: number, v: VisitRow) => void) {
  for (const v of visits) {
    const from = Math.max(v.started_at, start);
    const to = Math.min(visitEnd(v), end);
    if (to <= from) continue;
    // Step by hour from the top of the first hour, plus the very end so a visit crossing an hour counts in both.
    for (let t = from - (from % 3_600_000); t < to; t += 3_600_000) {
      const at = Math.max(t, from);
      each(dayOf(at), hourOf(at), v);
    }
  }
}

export function onlineNow(now = Date.now()): OnlineNow {
  const rows = all<{ visitor: string; user_id: number | null; email: string | null; platform: string; screen: string; since: number; last_seen: number }>(
    `SELECT p.visitor, p.user_id, u.email, p.platform, p.screen, v.started_at AS since, p.last_seen
     FROM presence p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN app_visits v ON v.id = p.visit_id
     WHERE p.last_seen >= ? ORDER BY v.started_at ASC`,
    now - ONLINE_MS,
  );
  const platforms: Record<string, number> = {};
  for (const r of rows) platforms[r.platform || 'other'] = (platforms[r.platform || 'other'] ?? 0) + 1;
  const members = rows.filter((r) => r.user_id !== null).length;
  return {
    now,
    total: rows.length,
    members,
    guests: rows.length - members,
    platforms,
    // Only the end of a device id is shown: enough to tell two guests apart.
    people: rows.slice(0, 100).map((r) => ({
      visitor: r.visitor.startsWith('ip:') ? 'IP' : `…${r.visitor.slice(-4)}`,
      userId: r.user_id,
      email: r.email,
      platform: r.platform,
      screen: r.screen,
      since: r.since ?? r.last_seen,
      lastSeen: r.last_seen,
    })),
  };
}

export function traffic(period: TrafficPeriod, now = Date.now(), range?: { from: string; to: string }): Traffic {
  const w = windowOf(period, now, range);
  const visits = visitsIn(w.start, w.end).filter((v) => visitEnd(v) > w.start);

  // Chart: per hour for one day, per day for a week or a month.
  const series: TrafficPoint[] = [];
  const hourSets = Array.from({ length: 24 }, () => new Set<string>());
  const perSlot = new Map<string, Set<string>>();
  slots(visits, w.start, w.end, (day, hour, v) => {
    hourSets[hour].add(`${day}|${v.visitor}`);
    const key = w.from === w.to ? String(hour) : day;
    if (!perSlot.has(key)) perSlot.set(key, new Set());
    perSlot.get(key)!.add(v.visitor);
  });
  // Visits started per hour ("day|hour") and per day, counted once instead of once per bar.
  const startedIn = new Map<string, number>();
  for (const v of visits) {
    if (v.started_at < w.start) continue;
    for (const key of [`${dayOf(v.started_at)}|${hourOf(v.started_at)}`, dayOf(v.started_at)]) startedIn.set(key, (startedIn.get(key) ?? 0) + 1);
  }
  const peaks = all<{ day: string; hour: number; peak: number }>('SELECT day, hour, peak FROM online_hours WHERE day >= ? AND day <= ?', w.from, w.to);
  if (w.from === w.to) {
    const nowHour = w.to === dayOf(now) ? hourOf(now) : 23;
    for (let h = 0; h < 24; h++) {
      series.push({
        label: `${h}h`,
        users: perSlot.get(String(h))?.size ?? 0,
        visits: startedIn.get(`${w.from}|${h}`) ?? 0,
        peak: peaks.find((p) => p.hour === h)?.peak ?? 0,
        future: h > nowHour,
      });
    }
  } else {
    const today = dayOf(now);
    for (let d = w.from; d <= w.to; d = addDays(d, 1)) {
      series.push({
        label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
        users: perSlot.get(d)?.size ?? 0,
        visits: startedIn.get(d) ?? 0,
        peak: Math.max(0, ...peaks.filter((p) => p.day === d).map((p) => p.peak)),
        future: d > today,
      });
    }
  }

  // Platform of each person (their latest visit in the period).
  const platformOf = new Map<string, string>();
  for (const v of [...visits].sort((a, b) => a.started_at - b.started_at)) platformOf.set(v.visitor, v.platform || 'other');
  const platformCount: Record<string, number> = {};
  for (const p of platformOf.values()) platformCount[p] = (platformCount[p] ?? 0) + 1;

  const screens = all<{ screen: string; beats: number }>(
    'SELECT screen, SUM(beats) AS beats FROM screen_time WHERE day >= ? AND day <= ? GROUP BY screen ORDER BY beats DESC',
    w.from,
    w.to,
  );

  // Members who spent the most time in the app.
  const byMember = new Map<number, { seconds: number; visits: number }>();
  for (const v of visits) {
    if (v.user_id === null) continue;
    const m = byMember.get(v.user_id) ?? { seconds: 0, visits: 0 };
    m.seconds += Math.max(0, Math.min(visitEnd(v), w.end) - Math.max(v.started_at, w.start)) / 1000;
    if (v.started_at >= w.start) m.visits++;
    byMember.set(v.user_id, m);
  }
  const top = [...byMember.entries()].sort((a, b) => b[1].seconds - a[1].seconds).slice(0, 10);
  const emails = new Map(
    top.length
      ? all<{ id: number; email: string }>(`SELECT id, email FROM users WHERE id IN (${top.map(() => '?').join(',')})`, ...top.map(([id]) => id)).map((u) => [u.id, u.email])
      : [],
  );

  return {
    period,
    from: w.from,
    to: w.to,
    today: dayOf(now),
    timeZone: timeZone(),
    since: get<{ t: number | null }>('SELECT MIN(started_at) AS t FROM app_visits')?.t ?? null,
    current: summarize(w.start, w.end),
    previous: summarize(w.prevStart, w.prevEnd),
    compareLabel: w.compareLabel,
    series,
    hours: hourSets.map((s) => s.size),
    platforms: Object.entries(platformCount)
      .map(([platform, users]) => ({ platform, users }))
      .sort((a, b) => b.users - a.users),
    screens: screens.map((s) => ({ screen: s.screen, seconds: Math.round((s.beats * HEARTBEAT_MS) / 1000) })),
    topMembers: top.map(([id, m]) => ({ id, email: emails.get(id) ?? `#${id}`, seconds: Math.round(m.seconds), visits: m.visits })),
    online: onlineNow(now),
  };
}
