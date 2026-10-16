import { GoogleAuth } from 'google-auth-library';
import { translate, type MessageKey } from '../i18n/core';
import { creditState, getAiSources, type RuntimeSource } from './aiSources';

/* ---------- AI sources ----------
 * Managed on the admin page (Settings: Vertex AI projects with service-account keys, AI Studio API keys, each with
 * its credit); until something is saved there, read from .env (same convention as nails-studio):
 *   GOOGLE_CLOUD_PROJECT=projA,projB@C:\keys\b.json   Vertex AI (Google Cloud credit). "@file" = own service-account key,
 *                                                     otherwise the machine login (gcloud auth application-default login).
 *   GOOGLE_CLOUD_LOCATION=global                      Gemini 3 image models run in "global" on Vertex.
 *   GEMINI_API_KEY=key1,key2                          Google AI Studio.
 * Sources are tried in order; one that is turned off, out of (estimated) credit, out of money, unauthorized
 * or rate limited is skipped.
 */

type Source =
  | { kind: 'vertex'; id: string; name: string; project: string; location: string; auth: GoogleAuth }
  | { kind: 'studio'; id: string; name: string; apiKey: string };

function build(r: RuntimeSource): Source {
  if (r.kind === 'studio') return { kind: 'studio', id: r.id, name: r.name, apiKey: r.apiKey ?? '' };
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    ...(r.credentials ? { credentials: r.credentials, projectId: r.project } : r.keyFilename ? { keyFilename: r.keyFilename } : {}),
  });
  return { kind: 'vertex', id: r.id, name: r.name, project: r.project ?? '', location: r.location, auth };
}

/** Clients are rebuilt only when the configuration changes (GoogleAuth caches its tokens). */
const g = globalThis as unknown as { __camiSources?: { version: string; runtime: RuntimeSource[]; built: Source[] } };

function current() {
  const src = getAiSources();
  if (g.__camiSources?.version !== src.version) {
    g.__camiSources = { version: src.version, runtime: src.sources, built: src.sources.map(build) };
  }
  return g.__camiSources;
}

/** Sources that may be used now: turned on, key readable, and not out of the credit entered for them. */
function usable() {
  const { runtime, built } = current();
  return built.filter((_, i) => {
    const r = runtime[i];
    return r.enabled && !r.broken && !(r.credit && creditState(r.id, r.credit).exhausted);
  });
}

export const hasAiSource = () => current().runtime.length > 0;

/** How many sources are configured and how many may be used now (for the admin page; never the keys themselves). */
export const aiSourceSummary = () => {
  const ok = usable();
  return { total: current().runtime.length, vertex: ok.filter((s) => s.kind === 'vertex').length, studio: ok.filter((s) => s.kind === 'studio').length };
};

/**
 * The model the user picked (or the server default), then Flash when it is busy or unavailable.
 * Never falls back to a pricier model: if Flash itself is busy, the user is told to try again.
 */
const imageModels = (preferred?: string) =>
  [...new Set([preferred ?? process.env.GEMINI_IMAGE_MODEL, 'gemini-3.1-flash-image'].filter(Boolean) as string[])];

/* ---------- Error classification ---------- */

/** `key` is the user-facing message (translated by the API route into the caller's language). */
export class AiError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly raw: string,
    readonly status: number,
  ) {
    super(key);
  }
}

const isOutOfMoney = (t: string) =>
  /prepayment credits are depleted|"code":\s*402|limit: 0|BILLING_DISABLED|requires billing|billing account .*(disabled|closed)/i.test(t);
const isRateLimit = (t: string) => /429|RESOURCE_EXHAUSTED/.test(t) && !isOutOfMoney(t);
const isNoAccess = (t: string) =>
  /API key not valid|API_KEY_INVALID|"code":\s*40[13]|PERMISSION_DENIED|UNAUTHENTICATED|Could not load the default credentials/i.test(t);
const isMissingModel = (t: string) => /"code":\s*404|not found|not supported/i.test(t);
const isTimeout = (t: string) => /TimeoutError|aborted|timed? ?out/i.test(t);

/** A short message for the app instead of Google's raw JSON. */
function friendly(t: string): MessageKey {
  if (/free_tier|FreeTier/.test(t) && /limit: 0/.test(t)) return 'server.aiNoBilling';
  if (isOutOfMoney(t)) return 'server.aiNoCredit';
  if (isRateLimit(t)) return 'server.aiBusy';
  if (isTimeout(t)) return 'server.aiTimeout';
  if (isNoAccess(t)) return 'server.aiNoAccess';
  if (isMissingModel(t)) return 'server.aiNoModel';
  return 'common.aiError';
}

/** Sources that recently failed for account reasons are skipped for a while (kept across dev reloads). */
const downUntil = ((globalThis as unknown as { __camiDown?: Map<string, number> }).__camiDown ??= new Map<string, number>());

/** Seconds until a source is tried again after an account error (0 = ready). */
export const retryIn = (id: string) => Math.max(0, Math.round(((downUntil.get(id) ?? 0) - Date.now()) / 1000));

function markDown(s: Source, t: string) {
  const ms = isRateLimit(t) ? 60_000 : isOutOfMoney(t) ? 6 * 3600_000 : 30 * 60_000;
  downUntil.set(s.id, Date.now() + ms);
  console.warn(`[ai] skipping ${s.id} for ${ms / 1000}s:`, t.slice(0, 200));
}

/* ---------- Calls ---------- */

async function endpoint(s: Source, model: string, method = 'generateContent'): Promise<{ url: string; headers: Record<string, string> }> {
  if (s.kind === 'studio') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`,
      headers: { 'x-goog-api-key': s.apiKey },
    };
  }
  const host = s.location === 'global' ? 'aiplatform.googleapis.com' : `${s.location}-aiplatform.googleapis.com`;
  const token = await s.auth.getAccessToken();
  if (!token) throw new Error('UNAUTHENTICATED: Could not load the default credentials');
  return {
    url: `https://${host}/v1/projects/${s.project}/locations/${s.location}/publishers/google/models/${model}:${method}`,
    headers: { authorization: `Bearer ${token}` },
  };
}

async function callOnce(s: Source, model: string, body: unknown, method?: string, timeoutMs = 90_000) {
  const { url, headers } = await endpoint(s, model, method);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  return JSON.parse(text);
}

export type EditResult = { image: string; mimeType: string; model: string; source: string };

/**
 * Edits one JPEG with an instruction (several JPEGs for "Ghép ảnh AI", numbered Photo 1, 2…), or creates a new picture from text when imageBase64 is null.
 * Tries every source and model until one returns an image.
 */
export async function editImage(
  imageBase64: string | string[] | null,
  instruction: string,
  systemInstruction: string,
  preferredModel?: string,
  aspectRatio?: string,
): Promise<EditResult> {
  const images = imageBase64 === null ? [] : Array.isArray(imageBase64) ? imageBase64 : [imageBase64];
  const jpeg = (data: string) => ({ inlineData: { mimeType: 'image/jpeg', data } });
  const pictures = images.length > 1 ? images.flatMap((data, i) => [{ text: `Photo ${i + 1}:` }, jpeg(data)]) : images.map(jpeg);
  if (!hasAiSource()) throw new AiError('server.noAiSource', '', 500);
  const all = usable();
  // Every source is turned off or out of the credit entered for it.
  if (!all.length) throw new AiError('server.aiNoCredit', 'no usable source', 503);
  const ready = all.filter((s) => (downUntil.get(s.id) ?? 0) <= Date.now());
  const order = ready.length ? ready : all;

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        role: 'user',
        parts: [...pictures, { text: instruction }],
      },
    ],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(aspectRatio && { imageConfig: { aspectRatio } }) },
  };

  let last = '';
  for (const s of order) {
    for (const model of imageModels(preferredModel)) {
      let data: any;
      try {
        data = await callOnce(s, model, body);
      } catch (e) {
        last = e instanceof Error ? `${e.name} ${e.message}` : String(e);
        console.error(`[ai] ${s.id} ${model} failed:`, last.slice(0, 300));
        if (isRateLimit(last) || isMissingModel(last) || isTimeout(last)) continue; // try the next model
        if (isOutOfMoney(last) || isNoAccess(last)) break; // try the next source
        throw new AiError(friendly(last), last, 502);
      }
      const out = (data?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data)?.inlineData;
      if (!out) {
        // Safety filters: a different source or model will refuse too.
        console.warn('[ai] no image returned', JSON.stringify(data?.candidates?.[0]?.finishReason ?? data?.promptFeedback));
        throw new AiError('server.aiCantDo', '', 422);
      }
      return { image: out.data, mimeType: out.mimeType ?? 'image/png', model, source: s.id };
    }
    if (isOutOfMoney(last) || isNoAccess(last) || isRateLimit(last)) markDown(s, last);
  }
  throw new AiError(friendly(last), last, 502);
}

export type TextResult = { text: string; model: string; source: string; inTokens: number; outTokens: number };

/** Text models tried after the one asked for (all available on AI Studio and Vertex "global"). */
const TEXT_FALLBACKS = ['gemini-3.5-flash', 'gemini-3-flash-preview'];

/**
 * Writes text (blog articles, topic ideas). With `json`, the model must answer with JSON only.
 * Same sources and fallbacks as images.
 */
export async function generateText(prompt: string, systemInstruction: string, opts: { model?: string; json?: boolean; timeoutMs?: number } = {}): Promise<TextResult> {
  if (!hasAiSource()) throw new AiError('server.noAiSource', '', 500);
  const all = usable();
  if (!all.length) throw new AiError('server.aiNoCredit', 'no usable source', 503);
  const ready = all.filter((s) => (downUntil.get(s.id) ?? 0) <= Date.now());
  const order = ready.length ? ready : all;
  const models = [...new Set([opts.model, process.env.GEMINI_TEXT_MODEL, ...TEXT_FALLBACKS].filter(Boolean) as string[])];

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 16_384, ...(opts.json && { responseMimeType: 'application/json' }) },
  };

  let last = '';
  for (const s of order) {
    for (const model of models) {
      let data: any;
      try {
        data = await callOnce(s, model, body, undefined, opts.timeoutMs ?? 180_000);
      } catch (e) {
        last = e instanceof Error ? `${e.name} ${e.message}` : String(e);
        console.error(`[ai] ${s.id} ${model} (text) failed:`, last.slice(0, 300));
        if (isRateLimit(last) || isMissingModel(last) || isTimeout(last)) continue;
        if (isOutOfMoney(last) || isNoAccess(last)) break;
        throw new AiError(friendly(last), last, 502);
      }
      const text = (data?.candidates?.[0]?.content?.parts ?? [])
        .filter((p: any) => typeof p.text === 'string' && !p.thought)
        .map((p: any) => p.text)
        .join('');
      if (!text.trim()) {
        console.warn('[ai] no text returned', JSON.stringify(data?.candidates?.[0]?.finishReason ?? data?.promptFeedback));
        throw new AiError('server.aiCantDo', '', 422);
      }
      const usage = data?.usageMetadata ?? {};
      return {
        text,
        model,
        source: s.id,
        inTokens: Number(usage.promptTokenCount ?? 0),
        outTokens: Number(usage.candidatesTokenCount ?? 0) + Number(usage.thoughtsTokenCount ?? 0),
      };
    }
    if (isOutOfMoney(last) || isNoAccess(last) || isRateLimit(last)) markDown(s, last);
  }
  throw new AiError(friendly(last), last, 502);
}

/**
 * Connection test for the admin page: counts the tokens of one word (free) on the app's image model.
 * This checks the project, the key, the permissions and access to that exact model, not the remaining credit.
 */
export async function testConnection(sources: RuntimeSource[]) {
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  return Promise.all(
    sources.map(async (r) => {
      if (r.broken) return { id: r.id, name: r.name, ok: false, message: r.broken };
      try {
        await callOnce(build(r), model, { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }, 'countTokens', 15_000);
        downUntil.delete(r.id);
        return { id: r.id, name: r.name, ok: true, message: `Kết nối được (model ${model})` };
      } catch (e) {
        const raw = e instanceof Error ? `${e.name} ${e.message}` : String(e);
        console.warn(`[ai] test ${r.id} failed:`, raw.slice(0, 300));
        return { id: r.id, name: r.name, ok: false, message: translate('vi', friendly(raw)) };
      }
    }),
  );
}
