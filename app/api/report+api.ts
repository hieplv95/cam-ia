import { caller } from '@/src/server/account';
import { tr } from '@/src/server/i18n';
import { addReport, ReportError } from '@/src/server/reports';

/** POST { tool, reason, note?, prompt?, image? }: someone reports an AI result as inappropriate. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: tr(request, 'server.badRequest') }, { status: 400 });
  try {
    addReport(caller(request), body);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof ReportError) return Response.json({ error: tr(request, e.key) }, { status: e.status });
    throw e;
  }
}
