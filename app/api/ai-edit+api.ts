import { aspectOf, combinePrompt, isCombineRatio, MAX_COMBINE, MAX_COMBINE_PROMPT, MIN_COMBINE } from '@/src/ai/combine';
import { generateStyles, isGenerateRatio } from '@/src/ai/generate';
import { pointsFor } from '@/src/ai/credits';
import { getPlan } from '@/src/server/plan';
import { DEFAULT_IMAGE_MODEL, isImageModel } from '@/src/ai/models';
import { aiPresets } from '@/src/ai/presets';
import { isRetouchOption, retouchPrompt } from '@/src/ai/retouch';
import { cleanChoices, cleanPart, MAX_BRAND, MAX_EXTRA, MAX_TAGLINE, studioProblem, studioPrompt, studioTool, takesReference } from '@/src/ai/studio';
import { caller, charge, creditsOf, isDenied, refund, settle, type Caller } from '@/src/server/account';
import { AiError, editImage, hasAiSource } from '@/src/server/gemini';
import { tr } from '@/src/server/i18n';
import { isolatePrint } from '@/src/server/printCrop';
import { logAi } from '@/src/server/stats';

const MAX_BASE64_LENGTH = 8 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 300;

const SAFETY_INSTRUCTION =
  'You are the photo-editing engine of a family-friendly photo app used by adults and children. Only produce wholesome results. ' +
  'Never make people look older, thinner or sexualized, and never add violence, weapons, scary or adult content. ' +
  'Unless asked otherwise, keep every person recognizable and keep their face shape, body shape and skin tone unchanged.';

// A light first line of defense; Gemini's own safety filters run as well.
const BLOCKED_WORDS = [
  'khỏa thân', 'khoả thân', 'sexy', 'gợi cảm', 'nude', 'naked', 'bikini', 'đồ lót', 'nội y',
  'máu', 'blood', 'súng', 'gun', 'con dao', 'knife', 'giết', 'kill', 'dead', 'ma quỷ', 'zombie',
  'thuốc lá', 'cigarette', 'rượu', 'beer', 'ma túy', 'drug', 'gầy đi', 'thon gọn', 'skinny',
  // Spanish / Portuguese (main markets)
  'desnud', 'sangre', 'sangue', 'pistola', 'matar', 'muerto', 'morto', 'cigarr', 'droga', 'cerveza', 'cerveja', 'nua ', 'pelad',
];

const json = (body: unknown, status = 200) => Response.json(body, { status });

const isBlocked = (text: string) => {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
};

export async function POST(request: Request) {
  if (!hasAiSource()) return json({ error: tr(request, 'server.noAiSource') }, 500);

  const appToken = process.env.APP_TOKEN;
  if (appToken && request.headers.get('x-app-token') !== appToken) {
    return json({ error: tr(request, 'server.forbidden') }, 401);
  }

  let body: {
    image?: string;
    preset?: string;
    prompt?: string;
    options?: unknown;
    model?: unknown;
    /** 'generate' = create a new picture from the prompt (no input image); 'combine' = merge `images` into one. */
    mode?: string;
    /** "Ghép ảnh": 2–3 JPEGs (base64), in the order the user put them. */
    images?: unknown;
    style?: unknown;
    aspectRatio?: unknown;
    /** 'studio' = one of the featured tools (restore, hairstyle & makeup, product, logo). */
    tool?: unknown;
    choices?: unknown;
    brand?: unknown;
    tagline?: unknown;
    /** Logo maker: a free-text extra request. */
    extra?: unknown;
    /** Product studio, one picture per product: { index, count } (counted from the left). */
    part?: unknown;
    /** With prompt: 'logo' = the picture is a logo made in the studio, edit it as a logo. */
    target?: unknown;
    /** "Xóa vật thể": remove what is painted over in red (marked) and/or described in `prompt`. */
    erase?: unknown;
    marked?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: tr(request, 'server.badRequest') }, 400);
  }

  const model = isImageModel(body.model) ? body.model : undefined;
  const modelId = model ?? process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
  // Requests are validated first; points / free tries are only taken right before the model is called.
  const who = caller(request);
  // The feature, for the admin statistics: 'generate', 'studio.<id>', 'preset.<id>' or 'prompt' (the user's own request).
  const tool =
    body.mode === 'generate'
      ? 'generate'
      : body.mode === 'combine'
        ? 'combine'
        : body.mode === 'studio'
          ? `studio.${studioTool(body.tool)?.id ?? 'unknown'}`
          : aiPresets.some((p) => p.id === body.preset)
            ? `preset.${body.preset}`
            : body.target === 'logo'
              ? 'logo-edit'
              : body.erase === true
                ? 'erase-brush'
                : 'prompt';
  const paid = (run: () => ReturnType<typeof editImage>) => respond(request, who, modelId, tool, run);
  const blocked = (key: 'server.blocked' | 'server.blockedName') => {
    logAi(who, { tool, model: modelId, status: 'blocked', error: 'blocked' });
    return json({ error: tr(request, key) }, 400);
  };

  if (body.mode === 'generate') {
    const wish = (body.prompt ?? '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!wish) return json({ error: tr(request, 'server.describeImage') }, 400);
    if (isBlocked(wish)) return blocked('server.blocked');
    const style = generateStyles.find((g) => g.id === body.style) ?? generateStyles[0];
    const ratio = isGenerateRatio(body.aspectRatio) ? body.aspectRatio : '1:1';
    const instruction = `${style.prompt} of: "${wish}" (the description may be in any language). Beautiful composition, flattering light, no text or watermark.`;
    return paid(() => editImage(null, instruction, SAFETY_INSTRUCTION, model, ratio));
  }

  if (body.mode === 'combine') {
    const images = Array.isArray(body.images) ? body.images : [];
    const valid = images.every((i) => typeof i === 'string' && i && i.length <= MAX_BASE64_LENGTH);
    if (!valid || images.length < MIN_COMBINE || images.length > MAX_COMBINE) return json({ error: tr(request, 'server.badImage') }, 400);
    const wish = (body.prompt ?? '').trim().slice(0, MAX_COMBINE_PROMPT);
    if (wish && isBlocked(wish)) return blocked('server.blocked');
    const ratio = isCombineRatio(body.aspectRatio) ? aspectOf(body.aspectRatio) : undefined;
    return paid(() => editImage(images as string[], combinePrompt(images.length, wish), SAFETY_INSTRUCTION, model, ratio));
  }

  if (body.mode === 'studio') {
    const tool = studioTool(body.tool);
    if (!tool) return json({ error: tr(request, 'server.badTool') }, 400);
    const choices = cleanChoices(tool, body.choices);
    // Quotes would break out of the quoted brand name in the prompt.
    const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/["“”\n\r]/g, ' ').trim().slice(0, max) : '');
    const brand = clean(body.brand, MAX_BRAND);
    const tagline = clean(body.tagline, MAX_TAGLINE);
    const extra = clean(body.extra, MAX_EXTRA);
    // The logo maker may get a reference image (the client's sketch or a logo they like); optional.
    const reference = !tool.needsPhoto && takesReference(tool) && typeof body.image === 'string' && body.image ? body.image : null;
    if (reference && reference.length > MAX_BASE64_LENGTH) return json({ error: tr(request, 'server.badImage') }, 400);
    const problem = studioProblem(tool, choices, brand, !!reference, !!extra);
    if (problem) return json({ error: tr(request, 'server.problem', { problem: tr(request, problem) }) }, 400);
    if (isBlocked(`${brand} ${tagline}`)) return blocked('server.blockedName');
    if (isBlocked(extra)) return blocked('server.blocked');
    if (!tool.needsPhoto) {
      const instruction = studioPrompt(tool, choices, { brand, tagline, reference: !!reference, extra });
      return paid(() => editImage(reference, instruction, SAFETY_INSTRUCTION, model, '1:1'));
    }
    const instruction = studioPrompt(tool, choices, { brand, tagline, extra, part: tool.id === 'product' ? cleanPart(body.part) : undefined });
    if (typeof body.image !== 'string' || !body.image || body.image.length > MAX_BASE64_LENGTH) {
      return json({ error: tr(request, 'server.badImage') }, 400);
    }
    const photo = body.image;
    // A photo of an old print (on a table, a wall, in a frame...): cut the print out first, the image model would keep the whole scene.
    if (tool.id === 'restore' && choices.fix?.includes('extract')) {
      return paid(async () => {
        const print = await isolatePrint(photo);
        if (!print) return editImage(photo, instruction, SAFETY_INSTRUCTION, model);
        const rest = { ...choices, fix: choices.fix.filter((id) => id !== 'extract') };
        return editImage(print, studioPrompt(tool, rest, { extra }), SAFETY_INSTRUCTION, model);
      });
    }
    return paid(() => editImage(photo, instruction, SAFETY_INSTRUCTION, model));
  }

  const image = body.image;
  if (!image || typeof image !== 'string' || image.length > MAX_BASE64_LENGTH) {
    return json({ error: tr(request, 'server.badImage') }, 400);
  }

  // "Xóa vật thể": the user painted over what should go (red marks on the photo) and/or described it.
  if (body.erase === true) {
    const marked = body.marked === true;
    const wish = (body.prompt ?? '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!marked && !wish) return json({ error: tr(request, 'server.describeEdit') }, 400);
    if (wish && isBlocked(wish)) return blocked('server.blocked');
    const fill =
      'Fill every removed area naturally so it blends with its surroundings (same background, lighting, perspective and texture), ' +
      'with no blur, smudge or leftover outline. Do not change anything else: keep every other person, face, object, color and detail exactly the same.';
    const eraseInstruction = marked
      ? 'Some parts of this photo are painted over with translucent red brush strokes. ' +
        'Completely remove the people or objects under those red marks (including their shadows and reflections), and remove the red marks themselves. ' +
        (wish ? `The user describes what to remove as (any language): "${wish}". ` : '') +
        fill
      : `Completely remove the following from this photo (the description may be in any language): "${wish}", including its shadows and reflections. ` + fill;
    return paid(() => editImage(image, eraseInstruction, SAFETY_INSTRUCTION, model));
  }

  let instruction: string;
  const preset = aiPresets.find((p) => p.id === body.preset);
  const retouch = Array.isArray(body.options) ? body.options.filter(isRetouchOption) : [];
  if (preset?.id === 'retouch' && retouch.length) {
    instruction = retouchPrompt(retouch);
  } else if (preset) {
    instruction = preset.prompt;
  } else {
    const wish = (body.prompt ?? '').trim().slice(0, MAX_PROMPT_LENGTH);
    if (!wish) return json({ error: tr(request, 'server.describeEdit') }, 400);
    if (isBlocked(wish)) return blocked('server.blocked');
    instruction =
      body.target === 'logo'
        ? `Edit this logo according to this request from the client (it may be in any language): "${wish}". ` +
          'Change only what is asked and keep everything else exactly the same: the design, the spelling of every word, the layout and the style. ' +
          'Keep it a clean flat vector logo on a plain light background, no mockup, no watermark.'
        : `Edit this photo according to this request from the user (it may be in any language): "${wish}".`;
  }

  return paid(() => editImage(image, instruction, SAFETY_INSTRUCTION, model));
}

/**
 * Takes the cost (a free try for guests, points for members), runs the AI call and returns the image with the
 * credits left. A failed call is refunded; a cheaper fallback model is charged at its own price.
 */
async function respond(request: Request, who: Caller, model: string, tool: string, run: () => ReturnType<typeof editImage>) {
  const held = charge(who, model);
  if (isDenied(held)) {
    logAi(who, { tool, model, status: 'denied', error: held.code });
    return json({ error: tr(request, held.key, held.params), code: held.code, credits: creditsOf(who) }, held.status);
  }
  const started = Date.now();
  try {
    const out = await run();
    settle(held.usageId, out.model, !!who.user);
    logAi(who, { tool, model: out.model, status: 'ok', ms: Date.now() - started, points: who.user ? pointsFor(getPlan(), out.model) : 0, source: out.source });
    console.log(`[ai] ok via ${out.source} (${out.model}) for ${who.user ? `user ${who.user.id}` : 'guest'}`);
    return json({ image: out.image, mimeType: out.mimeType, model: out.model, credits: creditsOf(who) });
  } catch (e) {
    refund(held.usageId);
    logAi(who, { tool, model, status: 'error', error: e instanceof AiError ? e.key : 'unexpected', ms: Date.now() - started });
    if (e instanceof AiError) return json({ error: tr(request, e.key) }, e.status);
    console.error('[ai] unexpected error', e);
    return json({ error: tr(request, 'common.aiError') }, 502);
  }
}
