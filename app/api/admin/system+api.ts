import { adminOf, systemInfo } from '@/src/server/admin';

/** Settings, server health and configuration checks. */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  return Response.json(systemInfo());
}
