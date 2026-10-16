import { randomUUID } from 'node:crypto';

import { CLIP_SECONDS, cleanSeconds, clipsFor, MAX_VIDEO_PROMPT, videoPrompt } from '@/src/ai/video';
import { caller, creditsOf } from '@/src/server/account';
import { isAdmin } from '@/src/server/admins';
import { AiError, checkVideo, hasAiSource, startVideo, type VideoCheck } from '@/src/server/gemini';
import { tr } from '@/src/server/i18n';
import { finishJob, isVideoDenied, jobOf, partsOf, recordJob, releaseVideo, reserveVideo, videoQuota, type VideoPart } from '@/src/server/videoJobs';
import { joinVideos } from '@/src/server/videoJoin';

const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * AI video (/video). Guests get a couple of free videos, then sign up; members pay points per video (videoJobs.ts).
 * POST { prompt, music?, seconds?, image? } starts one in the background;
 * GET ?id=… says where it stands and returns it when done; GET with no id returns the caller's quota.
 */
export async function POST(request: Request) {
  if (!hasAiSource()) return json({ error: tr(request, 'server.noAiSource') }, 500);
  const appToken = process.env.APP_TOKEN;
  if (appToken && request.headers.get('x-app-token') !== appToken) return json({ error: tr(request, 'server.forbidden') }, 401);

  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown; music?: unknown; seconds?: unknown; image?: unknown };
  const prompt = typeof body.prompt === 'string' ? body.prompt.replace(/["“”]/g, "'").replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_VIDEO_PROMPT) : '';
  if (!prompt) return json({ error: tr(request, 'video.describeFirst') }, 400);
  const image = typeof body.image === 'string' && body.image ? body.image : undefined;
  if (image && image.length > MAX_BASE64_LENGTH) return json({ error: tr(request, 'server.badImage') }, 400);

  const who = caller(request);
  const seconds = cleanSeconds(body.seconds);
  // 20 / 30 seconds: 2 or 3 clips, made at the same time and joined when all are ready.
  const clips = clipsFor(seconds);
  const held = reserveVideo(who, clips);
  if (isVideoDenied(held)) return json({ error: tr(request, held.key, held.params), code: held.code, quota: videoQuota(who) }, held.status);
  try {
    const music = body.music !== false;
    const started = await Promise.allSettled(
      Array.from({ length: clips }, (_, index) =>
        startVideo(videoPrompt(prompt, { hasImage: !!image, music, seconds, part: { index, count: clips } }), image, Math.min(seconds, CLIP_SECONDS)),
      ),
    );
    const failed = started.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
    const parts = started.map((r) => {
      const { id, source } = (r as PromiseFulfilledResult<{ id: string; source: string }>).value;
      return { id, source };
    });
    const id = parts.length > 1 ? `multi|${randomUUID()}` : parts[0].id;
    recordJob(who, id, parts, held.usageId);
    console.log(`[video] ${id.slice(0, 80)} for ${who.user ? `user ${who.user.id}` : 'guest'} (${seconds}s${image ? ', photo' : ''})`);
    return json({ id, quota: videoQuota(who), credits: creditsOf(who) });
  } catch (e) {
    releaseVideo(held.usageId);
    // Admins also see Google's own message, to find out what the model wants.
    if (e instanceof AiError) return json({ error: isAdmin(who.user) ? `${tr(request, e.key)}\n${e.raw.slice(0, 600)}` : tr(request, e.key) }, e.status);
    console.error('[video] start failed', e);
    return json({ error: tr(request, 'common.aiError') }, 502);
  }
}

/** Finished clips and joined videos, kept for a while so polls don't download or join them again. */
type Ready = { video: string; mimeType: string; at: number };
const cache = ((globalThis as unknown as { __camiVideoReady?: Map<string, Ready> }).__camiVideoReady ??= new Map<string, Ready>());
const joining = ((globalThis as unknown as { __camiVideoJoining?: Map<string, Promise<string>> }).__camiVideoJoining ??= new Map<string, Promise<string>>());
const remember = (key: string, r: Omit<Ready, 'at'>) => {
  for (const [k, v] of cache) if (Date.now() - v.at > 30 * 60_000) cache.delete(k);
  cache.set(key, { ...r, at: Date.now() });
};

/** Where one clip stands (from the cache once it is done). */
async function clip(part: VideoPart): Promise<VideoCheck> {
  const hit = cache.get(part.id);
  if (hit) return { status: 'done', video: hit.video, mimeType: hit.mimeType };
  const r = await checkVideo(part.id, part.source);
  if (r.status === 'done') remember(part.id, r);
  return r;
}

export async function GET(request: Request) {
  const who = caller(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ quota: videoQuota(who) });
  const job = jobOf(who, id);
  if (!job) return json({ error: tr(request, 'video.notFound') }, 404);
  const fail = (error: string) => {
    finishJob(job, false);
    console.warn(`[video] ${job.id.slice(0, 80)} failed: ${error.slice(0, 300)}`);
    // The reason stays in the server log; the user gets a plain message (admins see it too).
    return json({
      status: 'failed',
      error: isAdmin(who.user) ? `${tr(request, 'video.failed')}\n${error.slice(0, 600)}` : tr(request, 'video.failed'),
      quota: videoQuota(who),
      credits: creditsOf(who),
    });
  };
  try {
    const parts = partsOf(job);
    const results = await Promise.all(parts.map(clip));
    const bad = results.find((r): r is Extract<VideoCheck, { status: 'failed' }> => r.status === 'failed');
    if (bad) return fail(bad.error);
    const done = results.filter((r): r is Extract<VideoCheck, { status: 'done' }> => r.status === 'done');
    if (done.length < parts.length) return json({ status: 'running', state: `${done.length}/${parts.length}` });

    let video = done[0].video;
    if (parts.length > 1) {
      const joined = cache.get(job.id);
      if (joined) video = joined.video;
      else {
        // Several polls may arrive while ffmpeg runs: they all wait for the same join.
        let p = joining.get(job.id);
        if (!p) {
          p = joinVideos(done.map((d) => d.video)).finally(() => joining.delete(job.id));
          joining.set(job.id, p);
        }
        video = await p;
        remember(job.id, { video, mimeType: 'video/mp4' });
      }
    }
    finishJob(job, true);
    return json({ status: 'done', video, mimeType: parts.length > 1 ? 'video/mp4' : done[0].mimeType, quota: videoQuota(who), credits: creditsOf(who) });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('ffmpeg')) return fail(e.message);
    // A network hiccup: the page asks again a few seconds later.
    console.error('[video] check failed', e);
    return json({ status: 'running', state: 'retrying' });
  }
}
