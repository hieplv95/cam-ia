import { readImage } from '@/src/server/blog';

/** A blog picture (file names are random and never reused, so it can be cached for a year). */
export function GET(_request: Request, { name }: { name: string }) {
  const bytes = readImage(name);
  if (!bytes) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
