/** Monthly points renew at midnight on the 1st in this zone (IANA name, so daylight saving is handled). */
const TIME_ZONE = process.env.CAMI_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

/** Wall-clock date and time in TIME_ZONE at instant t. */
function zoned(t: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(t);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour'), minute: n('minute'), second: n('second') };
}

/** The instant when it is 00:00 on the 1st of the given month in TIME_ZONE (month may overflow, e.g. 12 → next January). */
function startOfMonth(year: number, month0: number) {
  const wall = Date.UTC(year, month0, 1);
  const offsetAt = (t: number) => {
    const z = zoned(t);
    return Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) - Math.floor(t / 1000) * 1000;
  };
  // Two passes settle the offset even when it changes around that moment (daylight saving).
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}

export function monthWindow(now = Date.now()) {
  const z = zoned(now);
  return { start: startOfMonth(z.year, z.month - 1), end: startOfMonth(z.year, z.month) };
}

/** "2026-10": the month an instant belongs to, used to group usage and monthly rewards. */
export function periodOf(t = Date.now()) {
  const z = zoned(t);
  return `${z.year}-${String(z.month).padStart(2, '0')}`;
}

/** "1/11": a day as people in TIME_ZONE would write it. */
export function dayLabel(t: number) {
  const z = zoned(t);
  return `${z.day}/${z.month}`;
}

/** "2026-10-05": the day an instant belongs to in TIME_ZONE, used to group statistics per day. */
export function dayOf(t = Date.now()) {
  const z = zoned(t);
  return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`;
}

/** The last `n` days (oldest first, today last). */
export function lastDays(n: number, now = Date.now()) {
  const days: string[] = [];
  const today = Date.parse(`${dayOf(now)}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i--) days.push(new Date(today - i * 86_400_000).toISOString().slice(0, 10));
  return days;
}

/** Midnight of a calendar day in the configured zone, including DST changes. */
export function startOfDay(day: string) {
  const wall = Date.parse(`${day}T00:00:00Z`);
  const offsetAt = (t: number) => {
    const z = zoned(t);
    return Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) - t;
  };
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}

export const timeZone = () => TIME_ZONE;

/** Hour of the day (0–23) at instant t in TIME_ZONE. */
export const hourOf = (t = Date.now()) => zoned(t).hour;

/** The calendar day `n` days after `day` ("2026-10-05" + 1 → "2026-10-06"). */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Monday of the week `day` belongs to (weeks start on Monday). */
export function mondayOf(day: string) {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}
