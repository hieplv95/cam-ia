import type { MessageKey } from '../i18n/core';

/**
 * Featured AI tools ("Công cụ nổi bật"), shared by the Studio screen and the API route (prompts).
 * The app only sends option ids; the server turns them into the English instruction below.
 * Texts shown in the app come from the translations, keyed by ids (see studioText).
 */
export type StudioOption = {
  id: string;
  prompt: string;
  /** Picking this option also picks these options in other groups (logo ideas preset style, layout and colors). */
  sets?: Record<string, string>;
};
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
        defaults: ['extract', 'scratches', 'noise', 'sharpen', 'colorize', 'faces'],
        options: [
          // Customers often photograph a print where it is (an altar, a wall, a frame, in a hand): keep only the print.
          { id: 'extract', prompt: 'take only the old photograph out of its surroundings' },
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
        // Ready-made ideas by business: the icon idea, plus a style, layout and colors that suit it.
        id: 'idea',
        defaults: [AUTO],
        options: [
          { id: AUTO, prompt: '' },
          {
            id: 'nails',
            prompt: 'a nail salon: an elegant icon such as a slender hand with long manicured nails, a nail polish bottle, or a fingertip merged with a small flower',
            sets: { look: 'luxury', layout: 'stacked', palette: 'pink' },
          },
          {
            id: 'spa',
            prompt: 'a beauty spa or skincare studio: a calm icon such as a lotus, a leaf or a soft face profile, conveying purity and relaxation',
            sets: { look: 'minimal', layout: 'stacked', palette: 'green' },
          },
          {
            id: 'hair',
            prompt: 'a hair salon or barber shop: an icon built from scissors, a comb or a flowing strand of hair',
            sets: { look: 'modern', layout: 'horizontal', palette: 'black' },
          },
          {
            id: 'bakery',
            prompt: 'a bakery or pastry shop: a warm icon such as a wheat stalk, a croissant, a whisk or a cupcake',
            sets: { look: 'vintage', layout: 'badge', palette: 'brown' },
          },
          {
            id: 'coffee',
            prompt: 'a coffee shop: an icon such as a coffee bean, or a cup whose steam forms a leaf or a heart',
            sets: { look: 'vintage', layout: 'badge', palette: 'brown' },
          },
          {
            id: 'food',
            prompt: 'a restaurant or street-food brand: an appetizing icon such as a chef hat, a fork and spoon, a cooking pot or a signature dish',
            sets: { look: 'modern', layout: 'stacked', palette: 'red' },
          },
          {
            id: 'fashion',
            prompt: 'a fashion boutique: a chic icon such as a hanger, a dress silhouette, a needle and thread, or an elegant monogram',
            sets: { look: 'luxury', layout: 'monogram', palette: 'black' },
          },
          {
            id: 'kids',
            prompt: "a kids' or toy shop: a playful icon such as a smiling star, a balloon, a teddy bear or building blocks",
            sets: { look: 'cute', layout: 'mascot', palette: 'colorful' },
          },
          {
            id: 'pets',
            prompt: 'a pet shop or pet groomer: a friendly icon such as a paw print, or a dog and a cat silhouette forming a heart',
            sets: { look: 'cute', layout: 'stacked', palette: 'blue' },
          },
          {
            id: 'fitness',
            prompt: 'a gym or fitness coach: an energetic icon such as a dumbbell, a running figure or a lightning bolt, conveying strength and movement',
            sets: { look: 'modern', layout: 'horizontal', palette: 'red' },
          },
          {
            id: 'photo',
            prompt: 'a photographer or photo studio: an icon such as a camera, a lens aperture or a viewfinder frame',
            sets: { look: 'minimal', layout: 'horizontal', palette: 'black' },
          },
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
        id: 'layout',
        defaults: [AUTO],
        options: [
          { id: AUTO, prompt: '' },
          { id: 'stacked', prompt: 'the icon centered above the brand name' },
          { id: 'horizontal', prompt: 'the icon on the left and the brand name on the right, on one line' },
          { id: 'wordmark', prompt: 'a wordmark only: the brand name in distinctive custom lettering, with at most a tiny accent and no separate icon' },
          { id: 'monogram', prompt: "a monogram: the brand's initials elegantly combined inside a simple shape, with the full brand name small underneath" },
          { id: 'badge', prompt: 'an emblem: the icon and the brand name together inside a circular or shield-shaped badge' },
          { id: 'mascot', prompt: 'a friendly mascot character as the icon, with the brand name underneath' },
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
          { id: 'brown', prompt: 'warm coffee brown and cream' },
          { id: 'red', prompt: 'warm red and orange' },
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
    case 'restore': {
      const fixes = picked(tool, choices, 'fix');
      const extract = fixes.some((o) => o.id === 'extract');
      const steps = fixes.filter((o) => o.id !== 'extract').map((o) => `- ${o.prompt}`);
      if (!extract) {
        return (
          'Restore this old photograph:\n' +
          (steps.length ? steps.join('\n') : '- gently clean it and improve its quality') +
          '\nKeep the composition, people, poses, clothing and background exactly the same, and keep it looking like a real photo (not a painting or illustration).' +
          request
        );
      }
      return (
        'This picture may be a photo taken OF an old printed photograph: for example on a wall, table or altar, in a frame or an album, ' +
        'held in a hand, photographed at an angle, with glare or reflections, next to flowers, candles or other pictures.\n' +
        'If so, first isolate ONLY that old photograph: straighten its perspective so it is flat and rectangular, crop away everything around it ' +
        '(frame, mat, glass, wall, cloth, flowers, candles, other pictures, hands) and remove glare and reflections. ' +
        'If the picture is already just the photograph, keep all of it.\n' +
        'Then restore the photograph:\n' +
        (steps.length ? steps.join('\n') : '- gently clean it and improve its quality') +
        "\nKeep the photograph's own content (people, faces, poses, clothing and the scene inside the print) exactly the same, and keep it looking like a real photo (not a painting or illustration). " +
        'The result must show only the restored photograph, filling the whole image, with no frame, border or surroundings.' +
        request
      );
    }
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
      const [idea] = p('idea').filter(Boolean);
      const [layout] = p('layout').filter(Boolean);
      const nameOnly = choices.layout?.includes('wordmark');
      const icon = nameOnly ? '' : ', with a simple memorable icon';
      const brand = text.brand?.trim();
      const tagline = text.tagline?.trim();
      const fromReference = choices.palette?.includes(REFERENCE_PALETTE);
      // "Like the reference" without a reference: let the model choose colors that suit the brand.
      const palette = fromReference && !text.reference ? undefined : p('palette').find(Boolean);
      const extra = text.extra?.trim() ? `Also follow this extra request from the client (may be in any language): "${text.extra.trim()}". ` : '';
      const business = tagline ? ` (business: "${tagline}", may be in any language)` : '';
      const about = brand ? `a brand named "${brand}"${business}` : `a business${business}`;
      const kind = idea ? `This is for ${idea}. ` : '';
      // What separates a designer's logo from clip art; the image model tends to over-decorate without it.
      const craft =
        'Work like a senior brand designer: one clear, distinctive idea that fits the business (not generic clip art), ' +
        'built from a few simple shapes with consistent line weight and clever use of negative space; at most 2–3 flat colors; ' +
        'clean, well-spaced typography that pairs with the icon; strong balance and alignment; it must stay recognizable when small and in a single color. ' +
        'Avoid photos, 3D, bevels, drop shadows, heavy gradients, tiny details and busy backgrounds. ';
      const finish = 'Centered on a plain white or very light background with generous margins, crisp flat vector look, no mockup, no watermark.';
      // Never recreate someone else's trademark, whatever the mode.
      const notOthers = "If the attached image is a well-known company's logo, do not reproduce it; only borrow its general style.";

      // The client's own sketch or draft: keep the idea, redraw it professionally.
      if (text.reference && !choices[REFERENCE_GROUP]?.includes('inspire')) {
        return (
          `The attached image is the client's own sketch or draft of the logo for ${about}. ` +
          'Redraw it as a polished, professional logo that clearly keeps its concept: the same main subject or character, ' +
          'its pose and expression, the key symbols and props, and the overall layout. ' +
          'Clean up the lines and proportions and make it work as a logo (bold, simple, readable at small sizes). ' +
          kind +
          (look ? `Finish: ${look}, applied only where it suits the sketch. ` : "Keep the sketch's own character and drawing style. ") +
          (layout ? `Arrange it as ${layout}. ` : '') +
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
        `Design a professional, original logo for ${about}. ${kind}` +
        `Style: ${look ?? 'whatever suits the brand best'}. Layout: ${layout ?? 'whatever lockup of icon and name suits the brand best'}. ` +
        `Colors: ${palette ?? 'colors that suit the brand'}. ` +
        (brand
          ? `Show the brand name "${brand}" spelled exactly like that as the wordmark${icon}. `
          : `Use the brand name written in the reference image, spelled exactly, as the wordmark${icon}; if it shows no name, make a symbol-only logo without words. `) +
        craft +
        `${extra}${finish} No extra words.`
      );
    }
  }
}
