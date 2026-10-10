import type { UserSort } from '@/src/admin/types';
import { adminOf, listUsers } from '@/src/server/admin';

const SORTS: UserSort[] = ['new', 'ai', 'active'];

/** Customer accounts: ?q= (email, name or invite code), ?sort=new|ai|active, ?offset=. */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  const sort = SORTS.find((s) => s === params.get('sort')) ?? 'new';
  const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0));
  return Response.json(listUsers(params.get('q') ?? '', sort, offset));
}
