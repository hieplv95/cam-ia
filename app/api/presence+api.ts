import { caller } from '@/src/server/account';
import { heartbeat } from '@/src/server/presence';

/** "Still here" from the app while it is on screen: { platform, screen } (see src/admin/presence.ts). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { platform?: unknown; screen?: unknown };
  const ok = heartbeat(caller(request), body);
  return Response.json({ ok }, { status: ok ? 200 : 429 });
}
