import { AdminError, adminOf, grantBonus, setLocked, userDetail } from '@/src/server/admin';

const notFound = () => Response.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });

/** One customer: points, AI history, bonus points, invited friends. */
export function GET(request: Request, { id }: Record<string, string>) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const detail = userDetail(Number(id));
  return detail ? Response.json(detail) : notFound();
}

/** { action: 'bonus', points, note } | { action: 'lock' } | { action: 'unlock' } */
export async function POST(request: Request, { id }: Record<string, string>) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; points?: unknown; note?: unknown };
  const userId = Number(id);
  try {
    if (body.action === 'bonus') grantBonus(admin, userId, body.points, body.note);
    else if (body.action === 'lock' || body.action === 'unlock') setLocked(admin, userId, body.action === 'lock');
    else return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const detail = userDetail(userId);
  return detail ? Response.json(detail) : notFound();
}
