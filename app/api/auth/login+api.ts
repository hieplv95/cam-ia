import { tr } from '@/src/server/i18n';
import { AccountError, caller, login } from '@/src/server/account';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json(await login(caller(request), body));
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: tr(request, e.key) }, { status: e.status });
    console.error('[auth] login failed', e);
    return Response.json({ error: tr(request, 'server.loginFailed') }, { status: 500 });
  }
}
