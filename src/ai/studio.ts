import type { MessageKey } from '../i18n/core';

/**
 * Featured AI tools ("Công cụ nổi bật"), shared by the Studio screen and the API route (prompts).
 * The app only sends option ids; the server turns them into the English instruction below.
 * Texts shown in the app come from the translations, keyed by ids (see studioText).
 */
export type StudioOption = { id: string; prompt: string };
export type StudioGroup = {
  id: string;
  /** Several options can be on at once (otherwise exactly one). */
  multi?: boolean;
  options: StudioOption[];
  defaults: string[];
};
export type StudioTool = {
  id: StudioToolId;
  /** Logos are drawn from scratch; the other tools edit the user's photo. */
  needsPhoto: boolean;
  groups: StudioGroup[];
};

export type StudioToolId = 'restore' | 'style' | 'product' | 'logo';

const KEEP = 'keep';

export const studioTools: StudioTool[] = [
  {
    id: 'restore',
    needsPhoto: true,
    groups: [
      {
        id: 'fix',
        multi: true,
        defaults: ['scratches', 'noise', 'sharpen', 'colorize', 'faces'],
        options: [
          { id: 'scratches', prompt: 'remove scratches, dust, stains, tears and fold marks' },
          { id: 'noise', prompt: 'remove noise and film grain' },
          { id: 'sharpen', prompt: 'sharpen blurry details and recover fine textures' },
          { id: 'colorize', prompt: 'if the photo is black-and-white or faded, colorize it with natural, historically plausible colors' },
          { id: 'faces', prompt: 'restore faces so they look clear and natural, without changing anyone’s identity or features' },
        ],
      },
    ],
  },
  {
    id: 'style',
    needsPhoto: true,
    groups: [
      {
        id: 'hair',
        defaults: [KEEP],
        options: [
          { id: KEEP, prompt: '' },
          { id: 'waves', prompt: 'long soft beach-wave curls' },
          { id: 'straight', prompt: 'long, sleek, straight hair' },
          { id: 'bob', prompt: 'a chic chin-length bob' },
          { id: 'bangs', prompt: 'the current length with light wispy see-through bangs' },
          { id: 'updo', prompt: 'an elegant high bun updo' },
          { id: 'curly', prompt: 'voluminous natural curls' },
        ],
      },
      {
        id: 'color',
        defaults: [KEEP],
        options: [
          { id: KEEP, prompt: '' },
          { id: 'chestnut', prompt: 'warm chestnut brown' },
          { id: 'caramel', prompt: 'caramel balayage' },
          { id: 'black', prompt: 'glossy jet black' },
          { id: 'ash', prompt: 'ash blonde' },
          { id: 'burgundy', prompt: 'deep burgundy red' },
          { id: 'rose', prompt: 'soft pastel pink' },
        ],
      },
      {
        id: 'makeup',
        defaults: ['natural'],
        options: [
          { id: KEEP, prompt: '' },
          { id: 'natural', prompt: 'natural "no-makeup" makeup: even skin, soft blush, nude lips' },
          { id: 'korean', prompt: 'Korean-style makeup: dewy glass skin, straight soft brows, gradient coral lips' },
          { id: 'glam', prompt: 'glamorous Latina makeup: bronzed glowing skin, defined brows, winged liner, glossy nude-brown lips' },
          { id: 'party', prompt: 'elegant evening makeup: soft smoky eyes, defined lashes, classic red lips' },
          { id: 'bridal', prompt: 'soft romantic bridal makeup: luminous skin, champagne shimmer eyes, rosy pink lips' },
        ],
      },
    ],
  },
  {
    id: 'product',
    needsPhoto: true,
    groups: [
      {
        id: 'scene',
        defaults: ['studio'],
        options: [
          { id: 'studio', prompt: 'a clean seamless white studio background with soft, even light and a gentle contact shadow (e-commerce style)' },
          { id: 'marble', prompt: 'a polished white marble surface with soft window light and subtle reflections' },
          { id: 'flowers', prompt: 'a soft cream backdrop with silk fabric and a few fresh flowers and petals around it' },
          { id: 'luxury', prompt: 'a dark, luxurious backdrop with dramatic rim light and golden highlights' },
          { id: 'beach', prompt: 'a sunny beach scene on warm sand with turquoise sea softly blurred behind' },
          { id: 'wood', prompt: 'a rustic warm wooden table with natural morning light and blurred green plants' },
          { id: 'pastel', prompt: 'a playful pastel backdrop with simple geometric podiums' },
        ],
      },
    ],
  },
  {
    id: 'logo',
    needsPhoto: false,
    groups: [
      {
        id: 'look',
        defaults: ['minimal'],
        options: [
          { id: 'minimal', prompt: 'minimalist, clean line icon with generous white space' },
          { id: 'luxury', prompt: 'elegant luxury style with a refined serif wordmark and a delicate emblem' },
          { id: 'cute', prompt: 'cute, friendly rounded style with a playful mascot-like icon' },
          { id: 'modern', prompt: 'bold modern geometric style with a strong sans-serif wordmark' },
          { id: 'vintage', prompt: 'vintage badge style with classic lettering' },
          { id: 'script', prompt: 'graceful hand-lettered script wordmark with a small flourish' },
        ],
      },
      {
        id: 'palette',
        defaults: ['gold'],
        options: [
          { id: 'gold', prompt: 'warm metallic gold and soft cream' },
          { id: 'black', prompt: 'black on white' },
          { id: 'pink', prompt: 'blush pink and rose gold' },
          { id: 'green', prompt: 'sage green and natural tones' },
          { id: 'blue', prompt: 'navy and sky blue' },
          { id: 'colorful', prompt: 'a cheerful harmonious multicolor palette' },
        ],
      },
    ],
  },
];

export const studioTool = (id: unknown) => studioTools.find((t) => t.id === id);

/** Translation keys for a tool's texts, a group's label and an option's label. */
export const studioText = {
  tool: (tool: StudioTool, part: 'title' | 'desc' | 'action' | 'busy') => `studio.${tool.id}.${part}` as MessageKey,
  group: (tool: StudioTool, group: StudioGroup) => `studio.${tool.id}.${group.id}` as MessageKey,
  option: (tool: StudioTool, group: StudioGroup, option: StudioOption) => `studio.${tool.id}.${group.id}.${option.id}` as MessageKey,
};

export type StudioChoices = Record<string, string[]>;

export const defaultChoices = (tool: StudioTool): StudioChoices => Object.fromEntries(tool.groups.map((g) => [g.id, [...g.defaults]]));

/** Keeps only known option ids (one per single-choice group) so the prompt is built from trusted text only. */
export function cleanChoices(tool: StudioTool, raw: unknown): StudioChoices {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    tool.groups.map((g) => {
      const ids = (Array.isArray(input[g.id]) ? (input[g.id] as unknown[]) : []).filter((v): v is string => g.options.some((o) => o.id === v));
      return [g.id, g.multi ? [...new Set(ids)] : ids.slice(0, 1)];
    }),
  );
}

const picked = (tool: StudioTool, choices: StudioChoices, groupId: string) => {
  const g = tool.groups.find((x) => x.id === groupId)!;
  return g.options.filter((o) => choices[groupId]?.includes(o.id) && o.id !== KEEP);
};

/** Why the request can't run yet (shown under the button), or null when it can. */
export function studioProblem(tool: StudioTool, choices: StudioChoices, brand: string): MessageKey | null {
  if (tool.id === 'restore' && !picked(tool, choices, 'fix').length) return 'studio.problem.restore';
  if (tool.id === 'style' && !['hair', 'color', 'makeup'].some((g) => picked(tool, choices, g).length)) return 'studio.problem.style';
  if (tool.id === 'logo' && !brand.trim()) return 'studio.problem.logo';
  return null;
}

export const MAX_BRAND = 30;
export const MAX_TAGLINE = 40;

/** The English instruction sent to the image model. */
export function studioPrompt(tool: StudioTool, choices: StudioChoices, text: { brand?: string; tagline?: string } = {}) {
  const p = (g: string) => picked(tool, choices, g).map((o) => o.prompt);
  switch (tool.id) {
    case 'restore':
      return (
        'Restore this old photograph:\n' +
        p('fix').map((s) => `- ${s}`).join('\n') +
        '\nKeep the composition, people, poses, clothing and background exactly the same, and keep it looking like a real photo (not a painting or illustration).'
      );
    case 'style': {
      const [hair] = p('hair');
      const [color] = p('color');
      const [makeup] = p('makeup');
      const steps = [
        hair && `- change the hairstyle to ${hair}${color ? '' : ', keeping the current hair color'}`,
        color && `- change the hair color to ${color}${hair ? '' : ', keeping the current hairstyle and length'}`,
        makeup && `- apply ${makeup}`,
      ].filter(Boolean);
      return (
        'Give the person in this photo a new look:\n' +
        steps.join('\n') +
        '\nKeep the same person: identical face, facial features, expression, age, skin tone, body, clothing, pose, background and framing. Photorealistic, natural result.'
      );
    }
    case 'product': {
      const [scene] = p('scene');
      return (
        `Turn this into a professional product photo: place the main product on ${scene}. ` +
        'Keep the product itself exactly the same — shape, colors, materials, labels, logos and any printed text must not change. ' +
        'Realistic lighting, shadows and reflections that match the scene, sharp focus on the product, commercial advertising quality, no added text or watermark.'
      );
    }
    case 'logo': {
      const [look] = p('look');
      const [palette] = p('palette');
      const tagline = text.tagline?.trim();
      return (
        `Design a professional logo for a brand named "${text.brand?.trim()}"${tagline ? ` (business: "${tagline}", may be in any language)` : ''}. ` +
        `Style: ${look}. Colors: ${palette}. ` +
        `Show the brand name "${text.brand?.trim()}" spelled exactly like that as the wordmark, with a simple memorable icon. ` +
        'Centered on a plain light background, flat vector look, high contrast, no mockup, no extra words or watermark.'
      );
    }
  }
}
