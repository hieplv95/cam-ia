import { MAX_VIDEO_EXTRA, videoPrompt, videoTemplate } from '@/src/ai/video';
import { adminOf, audit } from '@/src/server/admin';
import { AiError, checkVideo, startVideo } from '@/src/server/gemini';
import { tr } from '@/src/server/i18n';

const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

/**
 * AI video, admin only while it is being tried out (no points are taken; Google bills the AI source).
 * POST { template, extra?, music?, image? } starts a video; GET ?id=…&source=… says where it stands and returns it when done.
 */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const body = (await request.json().catch(() => ({}))) as { template?: unknown; extra?: unknown; music?: unknown; image?: unknown };
  const template = videoTemplate(body.template);
  if (!template) return Response.json({ error: 'Chọn một mẫu video.' }, { status: 400 });
  const extra = typeof body.extra === 'string' ? body.extra.replace(/["“”]/g, ' ').trim().slice(0, MAX_VIDEO_EXTRA) : '';
  if (template.id === 'custom' && !extra) return Response.json({ error: 'Mẫu "Tự mô tả" cần một câu mô tả.' }, { status: 400 });
  const image = typeof body.image === 'string' && body.image ? body.image : undefined;
  if (image && image.length > MAX_BASE64_LENGTH) return Response.json({ error: 'Ảnh quá lớn.' }, { status: 400 });
  const prompt = videoPrompt(template, { hasImage: !!image, extra, music: body.music !== false });
  try {
    const job = await startVideo(prompt, image);
    audit(admin, 'video', null, `Video AI: ${template.label}${image ? ' (có ảnh)' : ''}`);
    return Response.json({ ...job, prompt });
  } catch (e) {
    // Admins see Google's own message too, to find out what the new model wants.
    if (e instanceof AiError) return Response.json({ error: `${tr(request, e.key)}\n${e.raw.slice(0, 600)}` }, { status: e.status });
    throw e;
  }
}

export async function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const source = url.searchParams.get('source');
  if (!id || !source) return Response.json({ error: 'Thiếu mã video.' }, { status: 400 });
  try {
    return Response.json(await checkVideo(id, source));
  } catch (e) {
    console.error('[video] check failed', e);
    return Response.json({ status: 'failed', error: e instanceof Error ? e.message : String(e) });
  }
}
