import { tr } from '@/src/server/i18n';
import { AccountError, caller, register } from '@/src/server/account';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json(await register(caller(request), body));
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: tr(request, e.key) }, { status: e.status });
    console.error('[auth] register failed', e);
    return Response.json({ error: tr(request, 'server.registerFailed') }, { status: 500 });
  }
}
