import { MAX_VIDEO_EXTRA, videoPrompt, videoTemplate } from '@/src/ai/video';
import { caller, creditsOf } from '@/src/server/account';
import { isAdmin } from '@/src/server/admins';
import { AiError, checkVideo, hasAiSource, startVideo } from '@/src/server/gemini';
import { tr } from '@/src/server/i18n';
import { finishJob, isVideoDenied, jobOf, recordJob, releaseVideo, reserveVideo, videoQuota } from '@/src/server/videoJobs';

const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * AI video (/video). Guests get a couple of free videos, then sign up; members pay points per video (videoJobs.ts).
 * POST { template, extra?, music?, image? } starts one in the background;
 * GET ?id=… says where it stands and returns it when done; GET with no id returns the caller's quota.
 */
export async function POST(request: Request) {
  if (!hasAiSource()) return json({ error: tr(request, 'server.noAiSource') }, 500);
  const appToken = process.env.APP_TOKEN;
  if (appToken && request.headers.get('x-app-token') !== appToken) return json({ error: tr(request, 'server.forbidden') }, 401);

  const body = (await request.json().catch(() => ({}))) as { template?: unknown; extra?: unknown; music?: unknown; image?: unknown };
  const template = videoTemplate(body.template);
  if (!template) return json({ error: tr(request, 'server.badRequest') }, 400);
  const extra = typeof body.extra === 'string' ? body.extra.replace(/["“”\n\r]/g, ' ').trim().slice(0, MAX_VIDEO_EXTRA) : '';
  if (template.id === 'custom' && !extra) return json({ error: tr(request, 'video.describeFirst') }, 400);
  const image = typeof body.image === 'string' && body.image ? body.image : undefined;
  if (image && image.length > MAX_BASE64_LENGTH) return json({ error: tr(request, 'server.badImage') }, 400);

  const who = caller(request);
  const held = reserveVideo(who);
  if (isVideoDenied(held)) return json({ error: tr(request, held.key, held.params), code: held.code, quota: videoQuota(who) }, held.status);
  try {
    const job = await startVideo(videoPrompt(template, { hasImage: !!image, extra, music: body.music !== false }), image);
    recordJob(who, job.id, job.source, held.usageId);
    console.log(`[video] ${job.id} for ${who.user ? `user ${who.user.id}` : 'guest'} (${template.id}${image ? ', photo' : ''})`);
    return json({ id: job.id, quota: videoQuota(who), credits: creditsOf(who) });
  } catch (e) {
    releaseVideo(held.usageId);
    // Admins also see Google's own message, to find out what the model wants.
    if (e instanceof AiError) return json({ error: isAdmin(who.user) ? `${tr(request, e.key)}\n${e.raw.slice(0, 600)}` : tr(request, e.key) }, e.status);
    console.error('[video] start failed', e);
    return json({ error: tr(request, 'common.aiError') }, 502);
  }
}

export async function GET(request: Request) {
  const who = caller(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ quota: videoQuota(who) });
  const job = jobOf(who, id);
  if (!job) return json({ error: tr(request, 'video.notFound') }, 404);
  try {
    const r = await checkVideo(job.id, job.source);
    if (r.status === 'running') return json(r);
    finishJob(job, r.status === 'done');
    if (r.status === 'failed') console.warn(`[video] ${job.id} failed: ${r.error.slice(0, 300)}`);
    // The reason stays in the server log; the user gets a plain message.
    return r.status === 'done'
      ? json({ ...r, quota: videoQuota(who), credits: creditsOf(who) })
      : json({ status: 'failed', error: isAdmin(who.user) ? `${tr(request, 'video.failed')}\n${r.error.slice(0, 600)}` : tr(request, 'video.failed'), quota: videoQuota(who), credits: creditsOf(who) });
  } catch (e) {
    // A network hiccup: the page asks again a few seconds later.
    console.error('[video] check failed', e);
    return json({ status: 'running', state: 'retrying' });
  }
}
