import { adminOf, audit } from '@/src/server/admin';
import { getSeo, SeoSettingsError, setSeo } from '@/src/server/seo';

/** Website title, description and keywords per language, and the Google Search Console code (admin SEO tab). */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  return Response.json({ seo: getSeo() });
}

/** { primary?, verification?, texts?: { es: { title, description, keywords }, … } } */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const body = await request.json().catch(() => ({}));
  try {
    const seo = setSeo(body);
    const langs = Object.keys((body as { texts?: object }).texts ?? {});
    audit(admin, 'seo', null, `SEO: ${langs.length ? `sửa ${langs.join(', ')}` : 'cập nhật'} · ngôn ngữ chính ${seo.primary}${seo.verification ? ' · có mã Google' : ''}`);
    return Response.json({ seo });
  } catch (e) {
    if (e instanceof SeoSettingsError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
