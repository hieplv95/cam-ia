import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { accountState, apiFetch, openAuth } from '../account';
import { pointsFor } from './credits';
import { DEFAULT_IMAGE_MODEL, isImageModel, modelInfo, type ImageModelId } from './models';
import type { CombineRatio } from './combine';
import type { GenerateRatio, GenerateStyleId } from './generate';
import type { AiPresetId } from './presets';
import type { RetouchOptionId } from './retouch';
import type { StudioChoices, StudioToolId } from './studio';
import { t } from '../i18n';

/* ---------- Chosen model (persisted, shared by every screen) ---------- */

const MODEL_KEY = 'ai-image-model';
let currentModel: ImageModelId = DEFAULT_IMAGE_MODEL;
const listeners = new Set<(m: ImageModelId) => void>();
const loaded = AsyncStorage.getItem(MODEL_KEY)
  .then((v) => {
    if (isImageModel(v)) currentModel = v;
    listeners.forEach((l) => l(currentModel));
  })
  .catch(() => {});

export function setAiModel(m: ImageModelId) {
  currentModel = m;
  AsyncStorage.setItem(MODEL_KEY, m).catch(() => {});
  listeners.forEach((l) => l(m));
}

export function useAiModel() {
  const [model, setModel] = useState(currentModel);
  useEffect(() => {
    listeners.add(setModel);
    setModel(currentModel);
    return () => {
      listeners.delete(setModel);
    };
  }, []);
  return [model, setAiModel] as const;
}

/* ---------- Requests ---------- */

/** target 'logo': the picture is a logo from the studio, edited as a logo (same design, only the asked change). */
export type AiRequest =
  | { preset: AiPresetId; options?: RetouchOptionId[] }
  | { prompt: string; target?: 'logo' }
  /** "Xóa vật thể": marked = the photo carries red brush marks over what to remove; prompt = a description. */
  | { erase: true; marked: boolean; prompt?: string };

export type AiResult = {
  image: string;
  /** The model that actually produced the image (may differ when the chosen one was busy). */
  model: string;
  /** Short summary for a toast, e.g. "Flash · −1 điểm (còn 99)". */
  summary: string;
};

async function callAi(payload: Record<string, unknown>): Promise<AiResult> {
  await loaded;
  const requested = currentModel;
  const { ok, data } = await apiFetch('/api/ai-edit', { body: { model: requested, ...payload } });
  if (!ok || !data.image) {
    // Free tries used up: offer to sign up right away (the screen still shows the message).
    if (data?.code === 'login_required') openAuth({ reason: data.error, mode: 'register' });
    throw new Error(data?.error ?? t('common.aiError'));
  }

  const used = modelInfo(data.model) ?? modelInfo(requested);
  const name = used?.name ?? data.model;
  const fallback = data.model && data.model !== requested ? t('credits.summaryBusy', { model: modelInfo(requested)?.name ?? requested }) : '';
  const c = data.credits;
  const left = !c ? '' : c.kind === 'guest' ? t('credits.summaryGuest', { n: c.left }) : t('credits.summaryMember', { cost: pointsFor(accountState().plan, data.model ?? requested), n: c.left });
  return { image: data.image, model: data.model ?? requested, summary: `${fallback}${name}${left}` };
}

/** Sends a JPEG (base64) to the AI route with the chosen model and returns the edited image as base64. */
export function aiEdit(imageBase64: string, req: AiRequest): Promise<AiResult> {
  return callAi({ image: imageBase64, ...req });
}

/** Runs a featured tool: edits the photo (restore, hairstyle, product) or draws a logo when there is none. */
export function aiStudio(
  tool: StudioToolId,
  choices: StudioChoices,
  imageBase64: string | null,
  text: { brand?: string; tagline?: string; extra?: string; part?: { index: number; count: number } } = {},
) {
  return callAi({ mode: 'studio', tool, choices, image: imageBase64 ?? undefined, ...text });
}

/** Creates a brand-new picture from a text description. */
export function aiGenerate(prompt: string, style: GenerateStyleId, aspectRatio: GenerateRatio): Promise<AiResult> {
  return callAi({ mode: 'generate', prompt, style, aspectRatio });
}

/** "Ghép ảnh": merges 2–3 JPEGs (base64, in order) into one picture, following the optional request. */
export function aiCombine(images: string[], prompt: string, aspectRatio: CombineRatio): Promise<AiResult> {
  return callAi({ mode: 'combine', images, prompt, aspectRatio });
}
