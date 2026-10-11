import { AccountError, caller, creditsOf, deleteAccount } from '@/src/server/account';
import { isAdmin } from '@/src/server/admin';
import { getPlan } from '@/src/server/plan';
import { getRewardPoints } from '@/src/server/rewards';
import { tr } from '@/src/server/i18n';

/** Who is signed in (or null for a guest), how much AI use is left, the points plan and reward amounts, and whether they may open the admin page. */
export function GET(request: Request) {
  const c = caller(request);
  return Response.json({ user: c.user, credits: creditsOf(c), admin: isAdmin(c.user), rewardPoints: getRewardPoints(), plan: getPlan() });
}

/** Deletes the signed-in account after re-entering the password. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  try {
    await deleteAccount(caller(request), body.password);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: tr(request, e.key) }, { status: e.status });
    console.error('[auth] delete failed', e);
    return Response.json({ error: tr(request, 'server.deleteFailed') }, { status: 500 });
  }
}
