import { caller, creditsOf } from '@/src/server/account';
import { tr } from '@/src/server/i18n';
import { normalizeCode, recordVisit, rewardsOf } from '@/src/server/rewards';

/** Invite code and which rewards are still available this month. */
export function GET(request: Request) {
  const c = caller(request);
  if (!c.user) return Response.json({ error: tr(request, 'server.signInForRewards') }, { status: 401 });
  return Response.json({ rewards: rewardsOf(c.user.id), credits: creditsOf(c) });
}

/** The app was opened from a shared link: { ref: 'CODE', source?: 'fb' }. Anyone may report a visit. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { ref?: unknown; source?: unknown };
  const code = normalizeCode(body.ref);
  if (code) {
    const c = caller(request);
    recordVisit(code, typeof body.source === 'string' ? body.source : '', { userId: c.user?.id ?? null, device: c.device, ip: c.ip });
  }
  return Response.json({ ok: true });
}
