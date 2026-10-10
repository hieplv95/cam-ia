import { endSession } from '@/src/server/account';

export function POST(request: Request) {
  endSession(request);
  return Response.json({ ok: true });
}
