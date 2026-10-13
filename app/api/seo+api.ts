import { getSeo } from '@/src/server/seo';

/** Public: the website's search texts, read by server.cjs to write them into every page (all already public in the HTML). */
export function GET() {
  return Response.json(getSeo(), { headers: { 'Cache-Control': 'no-store' } });
}
