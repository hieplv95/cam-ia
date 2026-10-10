import type { MessageKey } from '../i18n/core';

/** Text-to-image options, shared by the "Tạo ảnh AI" screen and the API route (labels: generate.style.<id>). */
export const generateStyles = [
  { id: 'photo', prompt: 'A photorealistic, high-quality photograph with natural light' },
  { id: 'cartoon3d', prompt: 'A cute 3D animated movie style illustration with soft lighting' },
  { id: 'anime', prompt: 'A hand-drawn anime illustration with clean line art and soft cel shading' },
  { id: 'watercolor', prompt: 'A soft, dreamy watercolor painting on textured paper' },
  { id: 'oil', prompt: 'A rich, textured oil painting with visible brush strokes' },
] as const;

export type GenerateStyleId = (typeof generateStyles)[number]['id'];

export const generateRatios = ['1:1', '3:4', '4:5', '9:16', '16:9'] as const;
export type GenerateRatio = (typeof generateRatios)[number];

export const isGenerateRatio = (v: unknown): v is GenerateRatio => generateRatios.includes(v as GenerateRatio);

/** Example prompts shown as chips (translated, so they are in the user's language). */
export const generateIdeas: MessageKey[] = ['generate.idea1', 'generate.idea2', 'generate.idea3', 'generate.idea4', 'generate.idea5'];
