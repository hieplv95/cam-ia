import { caller } from '@/src/server/account';
import { track } from '@/src/server/stats';

/** Counts one use of a feature that runs on the phone: { name, detail? } (see src/admin/events.ts). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; detail?: unknown };
  const ok = track(caller(request), body.name, body.detail);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
