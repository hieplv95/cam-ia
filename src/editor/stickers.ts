import { moreStickers } from './stickersMore';

/** Hand-drawn SVG stickers on a 100x100 viewBox. Rendered by Skia so they look identical on every platform. */

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${body}</svg>`;

const HEART =
  'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z';

const face = (cx: number, cy: number) =>
  `<circle cx="${cx - 8}" cy="${cy}" r="3.2" fill="#3B2A4A"/><circle cx="${cx + 8}" cy="${cy}" r="3.2" fill="#3B2A4A"/>` +
  `<path d="M${cx - 6} ${cy + 7} Q${cx} ${cy + 12} ${cx + 6} ${cy + 7}" stroke="#3B2A4A" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
  `<circle cx="${cx - 14}" cy="${cy + 7}" r="3.6" fill="#FF8FC1" opacity="0.8"/><circle cx="${cx + 14}" cy="${cy + 7}" r="3.6" fill="#FF8FC1" opacity="0.8"/>`;

/** The first set; names are translations (sticker.<id>). */
const firstSet: { id: string; svg: string }[] = [
  {
    id: 'heart',
    svg: svg(
      `<path d="${HEART}" fill="#FF5FA2" stroke="#E63E87" stroke-width="3"/>` +
        '<ellipse cx="28" cy="28" rx="9" ry="6" fill="#FFFFFF" opacity="0.6" transform="rotate(-30 28 28)"/>',
    ),
  },
  {
    id: 'star',
    svg: svg(
      '<polygon points="50,8 61.8,35.8 91.8,38.4 69,58.2 75.9,87.6 50,72 24.1,87.6 31,58.2 8.2,38.4 38.2,35.8" fill="#FFD60A" stroke="#F2A900" stroke-width="4" stroke-linejoin="round"/>' +
        face(50, 50),
    ),
  },
  {
    id: 'crown',
    svg: svg(
      '<path d="M12 78 L8 30 L30 50 L50 18 L70 50 L92 30 L88 78 Z" fill="#FFD60A" stroke="#F2A900" stroke-width="4" stroke-linejoin="round"/>' +
        '<rect x="12" y="74" width="76" height="12" rx="4" fill="#FFC300" stroke="#F2A900" stroke-width="4"/>' +
        '<circle cx="50" cy="58" r="7" fill="#FF5FA2"/><circle cx="29" cy="63" r="5" fill="#4DB5FF"/><circle cx="71" cy="63" r="5" fill="#3CCFB4"/>' +
        '<circle cx="8" cy="30" r="5" fill="#FF5FA2"/><circle cx="50" cy="17" r="5" fill="#FF5FA2"/><circle cx="92" cy="30" r="5" fill="#FF5FA2"/>',
    ),
  },
  {
    id: 'bow',
    svg: svg(
      '<path d="M47 52 L34 88 L45 83 L52 56 Z" fill="#FF5FA2" stroke="#E63E87" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M53 52 L66 88 L55 83 L48 56 Z" fill="#FF5FA2" stroke="#E63E87" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M50 48 C38 28 6 22 6 44 C6 66 38 66 50 48 Z" fill="#FF7AB6" stroke="#E63E87" stroke-width="3"/>' +
        '<path d="M50 48 C62 28 94 22 94 44 C94 66 62 66 50 48 Z" fill="#FF7AB6" stroke="#E63E87" stroke-width="3"/>' +
        '<circle cx="50" cy="48" r="10" fill="#FF5FA2" stroke="#E63E87" stroke-width="3"/>' +
        '<circle cx="24" cy="40" r="4" fill="#FFFFFF" opacity="0.7"/><circle cx="76" cy="40" r="4" fill="#FFFFFF" opacity="0.7"/>',
    ),
  },
  {
    id: 'rainbow',
    svg: svg(
      '<path d="M10 80 A40 40 0 0 1 90 80" stroke="#FF3B3B" stroke-width="8" fill="none"/>' +
        '<path d="M18 80 A32 32 0 0 1 82 80" stroke="#FF9F1C" stroke-width="8" fill="none"/>' +
        '<path d="M26 80 A24 24 0 0 1 74 80" stroke="#FFD60A" stroke-width="8" fill="none"/>' +
        '<path d="M34 80 A16 16 0 0 1 66 80" stroke="#3CCFB4" stroke-width="8" fill="none"/>' +
        '<path d="M42 80 A8 8 0 0 1 58 80" stroke="#4DB5FF" stroke-width="8" fill="none"/>' +
        '<circle cx="12" cy="82" r="9" fill="#FFFFFF" stroke="#CFE8FF" stroke-width="2"/><circle cx="23" cy="85" r="8" fill="#FFFFFF" stroke="#CFE8FF" stroke-width="2"/>' +
        '<circle cx="88" cy="82" r="9" fill="#FFFFFF" stroke="#CFE8FF" stroke-width="2"/><circle cx="77" cy="85" r="8" fill="#FFFFFF" stroke="#CFE8FF" stroke-width="2"/>',
    ),
  },
  {
    id: 'flower',
    svg: svg(
      '<g fill="#FF8FC1" stroke="#FF5FA2" stroke-width="3">' +
        '<circle cx="50" cy="27" r="17"/><circle cx="71.9" cy="42.9" r="17"/><circle cx="63.5" cy="68.6" r="17"/><circle cx="36.5" cy="68.6" r="17"/><circle cx="28.1" cy="42.9" r="17"/></g>' +
        '<circle cx="50" cy="50" r="14" fill="#FFD60A" stroke="#F2A900" stroke-width="3"/>' +
        '<circle cx="45" cy="47" r="2.2" fill="#3B2A4A"/><circle cx="55" cy="47" r="2.2" fill="#3B2A4A"/>' +
        '<path d="M45 53 Q50 57 55 53" stroke="#3B2A4A" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'butterfly',
    svg: svg(
      '<ellipse cx="30" cy="36" rx="22" ry="19" fill="#8B6CF6" stroke="#6A4BE0" stroke-width="3"/>' +
        '<ellipse cx="70" cy="36" rx="22" ry="19" fill="#8B6CF6" stroke="#6A4BE0" stroke-width="3"/>' +
        '<ellipse cx="34" cy="66" rx="15" ry="14" fill="#FF8FC1" stroke="#FF5FA2" stroke-width="3"/>' +
        '<ellipse cx="66" cy="66" rx="15" ry="14" fill="#FF8FC1" stroke="#FF5FA2" stroke-width="3"/>' +
        '<circle cx="26" cy="34" r="6" fill="#FFFFFF" opacity="0.7"/><circle cx="74" cy="34" r="6" fill="#FFFFFF" opacity="0.7"/>' +
        '<rect x="45" y="26" width="10" height="54" rx="5" fill="#3B2A4A"/>' +
        '<path d="M48 28 Q40 12 32 10 M52 28 Q60 12 68 10" stroke="#3B2A4A" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<circle cx="32" cy="10" r="3.5" fill="#3B2A4A"/><circle cx="68" cy="10" r="3.5" fill="#3B2A4A"/>',
    ),
  },
  {
    id: 'catears',
    svg: svg(
      '<path d="M8 72 L22 12 L48 52 Z" fill="#FFB0D0" stroke="#E63E87" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M18 62 L25 30 L39 52 Z" fill="#FFE4F1"/>' +
        '<path d="M92 72 L78 12 L52 52 Z" fill="#FFB0D0" stroke="#E63E87" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M82 62 L75 30 L61 52 Z" fill="#FFE4F1"/>',
    ),
  },
  {
    id: 'bunny',
    svg: svg(
      '<ellipse cx="32" cy="48" rx="14" ry="42" fill="#FFFFFF" stroke="#E0C8D8" stroke-width="3" transform="rotate(-12 32 48)"/>' +
        '<ellipse cx="32" cy="50" rx="6.5" ry="29" fill="#FFB0D0" transform="rotate(-12 32 50)"/>' +
        '<ellipse cx="68" cy="48" rx="14" ry="42" fill="#FFFFFF" stroke="#E0C8D8" stroke-width="3" transform="rotate(12 68 48)"/>' +
        '<ellipse cx="68" cy="50" rx="6.5" ry="29" fill="#FFB0D0" transform="rotate(12 68 50)"/>',
    ),
  },
  {
    id: 'sun',
    svg: svg(
      '<g stroke="#FFB000" stroke-width="6" stroke-linecap="round">' +
        '<path d="M80 50 L92 50 M71.2 71.2 L79.7 79.7 M50 80 L50 92 M28.8 71.2 L20.3 79.7 M20 50 L8 50 M28.8 28.8 L20.3 20.3 M50 20 L50 8 M71.2 28.8 L79.7 20.3"/></g>' +
        '<circle cx="50" cy="50" r="23" fill="#FFD60A" stroke="#F2A900" stroke-width="3"/>' +
        face(50, 46),
    ),
  },
  {
    id: 'cloud',
    svg: svg(
      '<path d="M25 74 C9 74 7 52 22 50 C20 33 41 27 49 40 C55 25 80 28 79 47 C94 47 95 74 78 74 Z" fill="#FFFFFF" stroke="#A9D6FF" stroke-width="4" stroke-linejoin="round"/>' +
        face(51, 54),
    ),
  },
  {
    id: 'sparkle',
    svg: svg(
      '<path d="M46 10 C50 38 58 46 86 50 C58 54 50 62 46 90 C42 62 34 54 6 50 C34 46 42 38 46 10 Z" fill="#FFD60A" stroke="#F2A900" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M82 6 C83 14 85 16 93 17 C85 18 83 20 82 28 C81 20 79 18 71 17 C79 16 81 14 82 6 Z" fill="#FF8FC1"/>' +
        '<path d="M80 70 C81 76 82 77 88 78 C82 79 81 80 80 86 C79 80 78 79 72 78 C78 77 79 76 80 70 Z" fill="#8B6CF6"/>',
    ),
  },
  {
    id: 'glasses',
    svg: svg(
      `<g transform="translate(3 32) scale(0.44)"><path d="${HEART}" fill="#FF5FA2" fill-opacity="0.75" stroke="#C2185B" stroke-width="9"/></g>` +
        `<g transform="translate(53 32) scale(0.44)"><path d="${HEART}" fill="#FF5FA2" fill-opacity="0.75" stroke="#C2185B" stroke-width="9"/></g>` +
        '<path d="M44 42 Q50 36 56 42" stroke="#C2185B" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="16" cy="44" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.8"/><ellipse cx="66" cy="44" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.8"/>',
    ),
  },
  {
    id: 'unicorn',
    svg: svg(
      '<path d="M50 4 L64 70 L36 70 Z" fill="#FFE08A" stroke="#F2A900" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M39 56 L62 50 M42 40 L59 35 M46 24 L56 21" stroke="#F2A900" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="34" cy="76" r="10" fill="#FF8FC1"/><circle cx="50" cy="80" r="10" fill="#B9A6FF"/><circle cx="66" cy="76" r="10" fill="#7FE3CF"/>' +
        '<circle cx="34" cy="76" r="3.5" fill="#FFD60A"/><circle cx="50" cy="80" r="3.5" fill="#FFD60A"/><circle cx="66" cy="76" r="3.5" fill="#FFD60A"/>',
    ),
  },
  {
    id: 'balloon',
    svg: svg(
      '<path d="M50 78 Q40 88 52 97" stroke="#8A7898" stroke-width="2.5" fill="none"/>' +
        '<path d="M45 72 L55 72 L50 79 Z" fill="#E63E87"/>' +
        '<ellipse cx="50" cy="40" rx="28" ry="33" fill="#FF5FA2" stroke="#E63E87" stroke-width="3"/>' +
        '<ellipse cx="39" cy="27" rx="6" ry="10" fill="#FFFFFF" opacity="0.55" transform="rotate(25 39 27)"/>',
    ),
  },
  {
    id: 'icecream',
    svg: svg(
      '<path d="M30 52 L50 97 L70 52 Z" fill="#F4B860" stroke="#D98E2B" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M38 60 L60 76 M62 60 L42 80" stroke="#D98E2B" stroke-width="2"/>' +
        '<circle cx="38" cy="46" r="16" fill="#FF8FC1" stroke="#FF5FA2" stroke-width="3"/>' +
        '<circle cx="62" cy="46" r="16" fill="#7FE3CF" stroke="#3CCFB4" stroke-width="3"/>' +
        '<circle cx="50" cy="29" r="16" fill="#FFF0B3" stroke="#F2C94C" stroke-width="3"/>' +
        '<circle cx="50" cy="10" r="6" fill="#FF3B3B"/>' +
        '<rect x="42" y="24" width="6" height="2.5" rx="1" fill="#8B6CF6" transform="rotate(30 45 25)"/>' +
        '<rect x="54" y="30" width="6" height="2.5" rx="1" fill="#4DB5FF" transform="rotate(-20 57 31)"/>',
    ),
  },
];

/** Groups of the sticker panel (labels: sticker.cat.<id>). */
export const STICKER_CATEGORIES = ['all', 'love', 'travel', 'party', 'nature', 'decor', 'cute'] as const;
export type StickerCategory = (typeof STICKER_CATEGORIES)[number];

const FIRST_SET_CATEGORY: Record<string, Exclude<StickerCategory, 'all'>> = {
  heart: 'love',
  glasses: 'love',
  star: 'cute',
  crown: 'cute',
  catears: 'cute',
  bunny: 'cute',
  unicorn: 'cute',
  icecream: 'cute',
  rainbow: 'nature',
  flower: 'nature',
  butterfly: 'nature',
  sun: 'nature',
  cloud: 'nature',
  balloon: 'party',
  bow: 'decor',
  sparkle: 'decor',
};

export type Sticker = { id: string; cat: Exclude<StickerCategory, 'all'>; svg: string };

/** Every sticker, the first set first (drafts keep referring to stickers by id). */
export const stickers: Sticker[] = [...firstSet.map((s) => ({ ...s, cat: FIRST_SET_CATEGORY[s.id] ?? 'decor' })), ...moreStickers];
