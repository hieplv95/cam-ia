import type { TrafficPeriod } from '@/src/admin/types';
import { adminOf } from '@/src/server/admin';
import { customRange, onlineNow, traffic } from '@/src/server/presence';

const PERIODS: TrafficPeriod[] = ['today', 'yesterday', 'week', 'month', 'custom'];

/** Visits and online people: ?period=today|yesterday|week|month, ?period=custom&from=2026-10-01&to=2026-10-11, or ?live=1 for only who is online now. */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  if (params.get('live')) return Response.json(onlineNow());
  const period = params.get('period') as TrafficPeriod;
  if (period === 'custom') {
    const range = customRange(params.get('from'), params.get('to'));
    if (typeof range === 'string') return Response.json({ error: range }, { status: 400 });
    return Response.json(traffic('custom', Date.now(), range));
  }
  return Response.json(traffic(PERIODS.includes(period) ? period : 'today'));
}
