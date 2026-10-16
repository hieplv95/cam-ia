import type { MessageKey } from '../i18n/core';
import { generateRatios, type GenerateRatio } from './generate';

/** "Ghép ảnh AI": 2–4 photos and a description of how to put them together in one picture. */

export const MIN_COMBINE = 2;
export const MAX_COMBINE = 4;
export const MAX_COMBINE_PROMPT = 400;

/** 'auto' lets the AI pick the shape that suits the result. */
export const combineRatios = ['auto', ...generateRatios] as const;
export type CombineRatio = 'auto' | GenerateRatio;

/** Example requests shown as chips (translated, so they are in the user's language). */
export const combineIdeas: MessageKey[] = ['combine.idea1', 'combine.idea2', 'combine.idea3', 'combine.idea4'];

export function combinePrompt(count: number, wish: string) {
  return (
    `You get ${count} photos, numbered in the order given (Photo 1 is the first). ` +
    'Combine them into ONE new picture according to this request from the user (it may be in any language and may refer to the photos by their number): ' +
    `"${wish}".\n` +
    'Keep every person recognizable: the same face, hair, body shape, skin tone and clothing as in their photo, unless the request says otherwise. ' +
    'Unless the user asks for a collage, make it look like one real photo taken at the same moment: matching light, color, perspective, scale and shadows, ' +
    'with no visible seams, borders, cut-out edges or split layout. No text or watermark.'
  );
}
