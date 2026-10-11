import { adminOf, overview } from '@/src/server/admin';

/** Dashboard: 1 = today, -1 = yesterday, or the last 7, 30, 90 days. */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const days = Number(new URL(request.url).searchParams.get('days'));
  return Response.json(overview([1, -1, 7, 30, 90].includes(days) ? days : 1));
}
