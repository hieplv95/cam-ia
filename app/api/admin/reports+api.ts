import { adminOf, audit } from '@/src/server/admin';
import { actOnReport, listReports } from '@/src/server/reports';

/** GET ?status=open|done&offset=: reported AI results, newest first (Báo cáo tab). */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') === 'done' ? 'done' : 'open';
  return Response.json(listReports(status, Number(url.searchParams.get('offset')) || 0));
}

/** { id, action: 'done' | 'reopen' | 'delete' } */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const body = await request.json().catch(() => ({}));
  const row = actOnReport(Number(body.id), body.action);
  if (!row) return Response.json({ error: 'Không tìm thấy báo cáo hoặc thao tác không hợp lệ.' }, { status: 400 });
  const what = body.action === 'delete' ? 'Xóa' : body.action === 'done' ? 'Đã xử lý' : 'Mở lại';
  audit(admin, 'report', null, `${what} báo cáo #${row.id} (${row.tool}, ${row.reason})`);
  return Response.json({ ok: true });
}
