import type { MessageKey } from '../i18n/core';
import { generateRatios, type GenerateRatio } from './generate';

/** "Ghép ảnh": 2–3 photos merged into one, by the AI or as a collage. Shared by the screen and the API route. */
export const MIN_COMBINE = 2;
export const MAX_COMBINE = 3;
export const MAX_COMBINE_PROMPT = 300;

/** 'auto' lets the AI pick the frame (usually the shape of photo 1). */
export const combineRatios = ['auto', ...generateRatios] as const;
export type CombineRatio = (typeof combineRatios)[number];
export const isCombineRatio = (v: unknown): v is CombineRatio => combineRatios.includes(v as CombineRatio);
export const aspectOf = (r: CombineRatio): GenerateRatio | undefined => (r === 'auto' ? undefined : r);

/** Example requests shown as chips (translated, so they are in the user's language). */
export const combineIdeas: MessageKey[] = ['combine.idea.together', 'combine.idea.into1', 'combine.idea.beach', 'combine.idea.holding', 'combine.idea.studio'];

/** The instruction sent with the photos (in order: photo 1, photo 2, photo 3). */
export function combinePrompt(count: number, wish: string) {
  const list = Array.from({ length: count }, (_, i) => `photo ${i + 1}`).join(', ');
  return (
    `You are given ${count} photos, in this order: ${list}. Combine them into ONE single new photo. ` +
    (wish
      ? `Follow this request from the user (it may be in any language and may refer to the photos by number): "${wish}". `
      : 'Put the main people (or subjects) of every photo together in one natural scene, using the background of photo 1 unless it does not fit. ') +
    'The result must look like one real photo taken at a single moment: consistent lighting, colors, shadows, perspective and scale, ' +
    'with everyone at a natural size and position. Keep every person recognizable, with the same face, hair, body shape, skin tone and clothes ' +
    'as in their own photo, unless the request asks to change them. Do not make a collage, grid, split screen or borders unless the request asks for one. ' +
    'No text, no watermark.'
  );
}
