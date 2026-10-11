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
/** Palette option "like the reference image" (logo maker). */
export const REFERENCE_PALETTE = 'ref';
/** Logo maker: let the AI decide (or keep the sketch's own style / colors). */
export const AUTO = 'auto';
/** Logo maker group "use the reference image to": follow = redraw the sketch, inspire = only take ideas. */
export const REFERENCE_GROUP = 'use';

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
      {
        // One picture with everything, or one picture per product (one AI request each, left to right).
        id: 'split',
        defaults: ['one'],
        options: [
          { id: 'one', prompt: '' },
          { id: '2', prompt: '' },
          { id: '3', prompt: '' },
          { id: '4', prompt: '' },
        ],
      },
    ],
  },
  {
    id: 'logo',
    needsPhoto: false,
    groups: [
      {
        // Only offered when a reference image was added.
        id: REFERENCE_GROUP,
        defaults: ['follow'],
        options: [
          { id: 'follow', prompt: '' },
          { id: 'inspire', prompt: '' },
        ],
      },
      {
        id: 'look',
        defaults: [AUTO],
        options: [
          { id: AUTO, prompt: '' },
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
        defaults: [AUTO],
        options: [
          { id: AUTO, prompt: '' },
          { id: 'gold', prompt: 'warm metallic gold and soft cream' },
          { id: 'black', prompt: 'black on white' },
          { id: 'pink', prompt: 'blush pink and rose gold' },
          { id: 'green', prompt: 'sage green and natural tones' },
          { id: 'blue', prompt: 'navy and sky blue' },
          { id: 'colorful', prompt: 'a cheerful harmonious multicolor palette' },
          // Only offered when a reference image was added.
          { id: REFERENCE_PALETTE, prompt: 'the main colors of the reference image' },
        ],
      },
    ],
  },
];

export const studioTool = (id: unknown) => studioTools.find((t) => t.id === id);

/** Tools that may take an optional reference image as inspiration (the logo maker). */
export const takesReference = (tool: StudioTool) => tool.id === 'logo';

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
export function studioProblem(tool: StudioTool, choices: StudioChoices, brand: string, hasReference = false, hasExtra = false): MessageKey | null {
  // A written request is enough on its own for the photo tools.
  if (tool.id === 'restore' && !hasExtra && !picked(tool, choices, 'fix').length) return 'studio.problem.restore';
  if (tool.id === 'style' && !hasExtra && !['hair', 'color', 'makeup'].some((g) => picked(tool, choices, g).length)) return 'studio.problem.style';
  // A reference image (e.g. the client's sketch) can carry the name itself.
  if (tool.id === 'logo' && !brand.trim() && !hasReference) return 'studio.problem.logo';
  return null;
}

/** Product studio: how many separate pictures to make (1 = everything together). */
export const productSplit = (choices: StudioChoices) => Math.min(4, Math.max(1, Number(choices.split?.[0]) || 1));

/** Which product of a photo with several (0-based, counted from the left). */
export type ProductPart = { index: number; count: number };

export const cleanPart = (v: unknown): ProductPart | undefined => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const index = Number(o.index);
  const count = Number(o.count);
  return Number.isInteger(count) && count >= 2 && count <= 4 && Number.isInteger(index) && index >= 0 && index < count ? { index, count } : undefined;
};

const ORDINALS = ['first', 'second', 'third', 'fourth'];

export const MAX_BRAND = 30;
/** Free-text extra request for the logo maker. */
export const MAX_EXTRA = 200;
export const MAX_TAGLINE = 40;

/**
 * The English instruction sent to the image model.
 * `reference`: an inspiration image is attached (logo maker): its style may guide the design, but nothing is copied.
 */
export function studioPrompt(
  tool: StudioTool,
  choices: StudioChoices,
  text: { brand?: string; tagline?: string; reference?: boolean; extra?: string; part?: ProductPart } = {},
) {
  const p = (g: string) => picked(tool, choices, g).map((o) => o.prompt);
  // What the client typed (any language), checked against the content filter on the server.
  const request = text.extra?.trim() ? `\nAlso follow this request from the client (it may be in any language; it takes priority over the instructions above): "${text.extra.trim()}".` : '';
  switch (tool.id) {
    case 'restore':
      return (
        'Restore this old photograph:\n' +
        p('fix').map((s) => `- ${s}`).join('\n') +
        '\nKeep the composition, people, poses, clothing and background exactly the same, and keep it looking like a real photo (not a painting or illustration).' +
        request
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
        '\nKeep the same person: identical face, facial features, expression, age, skin tone, body, clothing, pose, background and framing. Photorealistic, natural result.' +
        request
      );
    }
    case 'product': {
      const [scene] = p('scene');
      const part = text.part;
      return (
        (part
          ? `This photo shows ${part.count} separate products. Keep ONLY the ${ORDINALS[part.index]} product counting from the left ` +
            `(product ${part.index + 1} of ${part.count}) and completely remove all the other products, with no leftover parts, shadows or reflections. ` +
            `Then turn it into a professional product photo: place this single product alone and centered on ${scene}. `
          : `Turn this into a professional product photo: place the main product on ${scene}. `) +
        'Keep the product itself exactly the same — shape, colors, materials, labels, logos and any printed text must not change. ' +
        'Realistic lighting, shadows and reflections that match the scene, sharp focus on the product, commercial advertising quality, no added text or watermark.' +
        request
      );
    }
    case 'logo': {
      // "Auto" has no prompt: the model decides (or keeps the sketch's own look).
      const look = p('look').find(Boolean);
      const brand = text.brand?.trim();
      const tagline = text.tagline?.trim();
      const fromReference = choices.palette?.includes(REFERENCE_PALETTE);
      // "Like the reference" without a reference: let the model choose colors that suit the brand.
      const palette = fromReference && !text.reference ? undefined : p('palette').find(Boolean);
      const extra = text.extra?.trim() ? `Also follow this extra request from the client (may be in any language): "${text.extra.trim()}". ` : '';
      const business = tagline ? ` (business: "${tagline}", may be in any language)` : '';
      const about = brand ? `a brand named "${brand}"${business}` : `a business${business}`;
      const finish = 'Centered on a plain light background, flat vector look, high contrast, no mockup, no watermark.';
      // Never recreate someone else's trademark, whatever the mode.
      const notOthers = "If the attached image is a well-known company's logo, do not reproduce it; only borrow its general style.";

      // The client's own sketch or draft: keep the idea, redraw it professionally.
      if (text.reference && !choices[REFERENCE_GROUP]?.includes('inspire')) {
        return (
          `The attached image is the client's own sketch or draft of the logo for ${about}. ` +
          'Redraw it as a polished, professional logo that clearly keeps its concept: the same main subject or character, ' +
          'its pose and expression, the key symbols and props, and the overall layout. ' +
          'Clean up the lines and proportions and make it work as a logo (bold, simple, readable at small sizes). ' +
          (look ? `Finish: ${look}, applied only where it suits the sketch. ` : "Keep the sketch's own character and drawing style. ") +
          `Colors: ${palette ?? 'a harmonious palette that suits the concept'}. ` +
          (brand
            ? `The brand name must read "${brand}", spelled exactly like that. Keep any other text written in the sketch (such as a slogan), spelled exactly as written; add no other words. `
            : 'Keep the brand name and any other text written in the sketch (such as a slogan) exactly as written, letter by letter; add no other words. If the sketch has no text, make a symbol-only logo without words. ') +
          `${extra}${notOthers} ${finish}`
        );
      }
      return (
        (text.reference
          ? 'The attached image is a reference for inspiration: take ideas from its overall style, shapes' +
            (fromReference ? ', mood and colors' : ' and mood') +
            `, but create a new, original logo rather than a copy of it. ${notOthers} `
          : '') +
        `Design a professional logo for ${about}. ` +
        `Style: ${look ?? 'whatever suits the brand best'}. Colors: ${palette ?? 'colors that suit the brand'}. ` +
        (brand
          ? `Show the brand name "${brand}" spelled exactly like that as the wordmark, with a simple memorable icon. `
          : 'Use the brand name written in the reference image, spelled exactly, as the wordmark, with a simple memorable icon; if it shows no name, make a symbol-only logo without words. ') +
        `${extra}${finish} No extra words.`
      );
    }
  }
}
