import { isLang } from '@/src/i18n/languages';
import { publishedPost, publishedPosts, publishedSlugs } from '@/src/server/blog';

/**
 * Public blog: ?slug=… one published article · ?sitemap=1 slugs for sitemap.xml ·
 * otherwise the latest published articles (?lang=es&limit=3; other languages when there are none in that one).
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const headers = { 'Cache-Control': 'public, max-age=60' };
  const slug = params.get('slug');
  if (slug) {
    const post = publishedPost(slug);
    return post ? Response.json({ post }, { headers }) : Response.json({ error: 'not found' }, { status: 404, headers });
  }
  if (params.get('sitemap')) return Response.json({ posts: publishedSlugs() }, { headers });
  const limit = Math.max(1, Math.min(50, Number(params.get('limit')) || 50));
  const lang = params.get('lang');
  const mine = isLang(lang) ? publishedPosts(lang, limit) : [];
  return Response.json({ posts: mine.length ? mine : publishedPosts(undefined, limit), lang: mine.length ? lang : null }, { headers });
}
