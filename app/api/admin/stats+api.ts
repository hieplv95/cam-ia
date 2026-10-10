import { adminOf, overview } from '@/src/server/admin';

/** Dashboard numbers for the last ?days= days (7, 30 or 90). */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const days = Number(new URL(request.url).searchParams.get('days'));
  return Response.json(overview([7, 30, 90].includes(days) ? days : 30));
}
