/**
 * Image-editing models the user can pick from (shared by the app and the API route). Prices are per ~1K image;
 * `points` is what one result costs a signed-in user (see credits.ts).
 */
export const imageModels = [
  { id: 'gemini-3.1-flash-image', name: 'Flash', usd: 0.067, points: 1 },
  { id: 'gemini-3-pro-image', name: 'Pro', usd: 0.134, points: 2 },
] as const;

export type ImageModelId = (typeof imageModels)[number]['id'];

export const DEFAULT_IMAGE_MODEL: ImageModelId = 'gemini-3.1-flash-image';

export const isImageModel = (v: unknown): v is ImageModelId => imageModels.some((m) => m.id === v);

export const modelInfo = (id: string) => imageModels.find((m) => m.id === id);

/** Same rate as nails-studio; update when the exchange rate moves. */
const USD_TO_VND = 26000;

export const formatVnd = (usd: number) => `${(Math.round((usd * USD_TO_VND) / 100) * 100).toLocaleString('vi-VN')}đ`;
