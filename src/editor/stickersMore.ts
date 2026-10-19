/**
 * The second set of hand-drawn SVG stickers (100x100 viewBox), grouped like the sticker panel:
 * love, travel, party, nature, decor (washi tape, doodles) and cute. Drawn by Skia like the first set.
 */
import type { StickerCategory } from './stickers';

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${body}</svg>`;

const HEART =
  'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z';

const heartAt = (x: number, y: number, k: number, fill: string, stroke: string, width = 3) =>
  `<g transform="translate(${x} ${y}) scale(${k})"><path d="${HEART}" fill="${fill}" stroke="${stroke}" stroke-width="${width / k}"/></g>`;

/** A four-point sparkle centred on (x, y). */
const sparkle = (x: number, y: number, r: number, fill: string) =>
  `<path d="M${x} ${y - r} C${x + r * 0.15} ${y - r * 0.15} ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y} C${x + r * 0.15} ${y + r * 0.15} ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r} C${x - r * 0.15} ${y + r * 0.15} ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y} C${x - r * 0.15} ${y - r * 0.15} ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r} Z" fill="${fill}"/>`;

const petals = (n: number, rx: number, ry: number, dist: number, fill: string, stroke: string) =>
  Array.from({ length: n }, (_, i) => `<ellipse cx="50" cy="${50 - dist}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2" transform="rotate(${(360 / n) * i} 50 50)"/>`).join('');

const eyes = (cx: number, cy: number, gap: number) =>
  `<circle cx="${cx - gap}" cy="${cy}" r="3.4" fill="#3B2A4A"/><circle cx="${cx + gap}" cy="${cy}" r="3.4" fill="#3B2A4A"/>`;

export const moreStickers: { id: string; cat: Exclude<StickerCategory, 'all'>; svg: string }[] = [
  /* ---------- love ---------- */
  {
    id: 'heartline',
    cat: 'love',
    svg: svg(
      `<path d="${HEART}" fill="none" stroke="#E8577B" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
        '<path d="M14 30 C16 18 26 13 34 15" stroke="#E8577B" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>',
    ),
  },
  {
    id: 'hearts',
    cat: 'love',
    svg: svg(heartAt(4, 26, 0.62, '#FF8FB8', '#E8577B') + heartAt(50, 8, 0.44, '#E53950', '#B71C3C') + sparkle(86, 70, 9, '#FFD60A')),
  },
  {
    id: 'lips',
    cat: 'love',
    svg: svg(
      '<path d="M8 50 C22 32 36 30 50 41 C64 30 78 32 92 50 C70 54 30 54 8 50 Z" fill="#E53950" stroke="#B71C3C" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M8 50 C30 56 70 56 92 50 C80 74 64 82 50 82 C36 82 20 74 8 50 Z" fill="#F0506A" stroke="#B71C3C" stroke-width="3" stroke-linejoin="round"/>' +
        '<ellipse cx="38" cy="66" rx="9" ry="4" fill="#FFFFFF" opacity="0.45"/>',
    ),
  },
  {
    id: 'letter',
    cat: 'love',
    svg: svg(
      '<rect x="8" y="24" width="84" height="58" rx="7" fill="#FFF4F0" stroke="#E8A598" stroke-width="3"/>' +
        '<path d="M10 28 L50 58 L90 28" fill="none" stroke="#E8A598" stroke-width="3" stroke-linejoin="round"/>' +
        heartAt(39, 47, 0.24, '#FF5FA2', '#E63E87', 2),
    ),
  },
  {
    id: 'heartarrow',
    cat: 'love',
    svg: svg(
      '<path d="M8 84 L92 18" stroke="#8D6E63" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M92 18 L78 20 M92 18 L89 32" stroke="#8D6E63" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M8 84 L10 74 M8 84 L18 82 M14 79 L16 69 M14 79 L24 77" stroke="#FF8FB8" stroke-width="3" stroke-linecap="round"/>' +
        heartAt(24, 22, 0.52, '#FF5FA2', '#E63E87'),
    ),
  },

  /* ---------- travel ---------- */
  {
    id: 'plane',
    cat: 'travel',
    svg: svg(
      '<path d="M8 94 Q26 80 30 66" stroke="#9AA7B8" stroke-width="3" fill="none" stroke-dasharray="5 5" stroke-linecap="round"/>' +
        '<path d="M88 12 C92 8 96 12 92 16 L64 44 L72 82 L64 88 L50 56 L34 72 L36 84 L30 88 L24 76 L12 70 L16 64 L28 66 L44 50 L12 36 L18 28 L56 36 Z" fill="#4DB5FF" stroke="#1E78C8" stroke-width="3" stroke-linejoin="round"/>',
    ),
  },
  {
    id: 'suitcase',
    cat: 'travel',
    svg: svg(
      '<path d="M38 30 V22 Q38 15 45 15 H55 Q62 15 62 22 V30" stroke="#8D5A2B" stroke-width="5" fill="none"/>' +
        '<rect x="14" y="30" width="72" height="56" rx="9" fill="#FF8A3D" stroke="#D9661A" stroke-width="3"/>' +
        '<rect x="28" y="30" width="7" height="56" fill="#D9661A"/><rect x="65" y="30" width="7" height="56" fill="#D9661A"/>' +
        '<circle cx="50" cy="52" r="7" fill="#FFD60A"/><rect x="42" y="66" width="16" height="9" rx="3" fill="#4DB5FF"/>',
    ),
  },
  {
    id: 'camera',
    cat: 'travel',
    svg: svg(
      '<rect x="34" y="18" width="26" height="14" rx="4" fill="#4A4A5C"/>' +
        '<rect x="8" y="28" width="84" height="58" rx="11" fill="#3B3B4A" stroke="#26262F" stroke-width="3"/>' +
        '<circle cx="50" cy="57" r="20" fill="#9AD1FF" stroke="#E8E8F0" stroke-width="6"/>' +
        '<circle cx="50" cy="57" r="8" fill="#2E6FA8"/><circle cx="44" cy="51" r="4" fill="#FFFFFF" opacity="0.8"/>' +
        '<rect x="72" y="36" width="12" height="7" rx="2" fill="#FFD60A"/>',
    ),
  },
  {
    id: 'palm',
    cat: 'travel',
    svg: svg(
      '<path d="M50 94 Q44 70 52 40" stroke="#8D6E63" stroke-width="8" fill="none" stroke-linecap="round"/>' +
        '<g fill="#3CB371" stroke="#2E8B57" stroke-width="2" stroke-linejoin="round">' +
        '<path d="M52 40 Q30 16 8 30 Q32 28 52 40 Z"/><path d="M52 40 Q74 14 94 28 Q70 28 52 40 Z"/>' +
        '<path d="M52 40 Q46 12 22 10 Q42 22 52 40 Z"/><path d="M52 40 Q64 10 86 10 Q64 22 52 40 Z"/>' +
        '<path d="M52 40 Q28 40 16 58 Q36 44 52 40 Z"/><path d="M52 40 Q78 42 88 60 Q68 46 52 40 Z"/></g>' +
        '<circle cx="47" cy="44" r="5" fill="#8D5A2B"/><circle cx="56" cy="45" r="5" fill="#8D5A2B"/>',
    ),
  },
  {
    id: 'pin',
    cat: 'travel',
    svg: svg(
      '<ellipse cx="50" cy="92" rx="16" ry="4" fill="#000000" opacity="0.15"/>' +
        '<path d="M50 90 C50 90 20 58 20 38 A30 30 0 0 1 80 38 C80 58 50 90 50 90 Z" fill="#FF3B3B" stroke="#C62828" stroke-width="3"/>' +
        '<circle cx="50" cy="38" r="11" fill="#FFFFFF"/>',
    ),
  },
  {
    id: 'globe',
    cat: 'travel',
    svg: svg(
      '<circle cx="50" cy="50" r="40" fill="#4DB5FF" stroke="#1E78C8" stroke-width="3"/>' +
        '<path d="M26 26 C36 22 44 30 40 38 C36 46 26 44 22 52 C18 44 18 32 26 26 Z" fill="#3CB371"/>' +
        '<path d="M56 18 C68 20 80 30 82 44 C74 44 70 38 62 40 C56 34 50 26 56 18 Z" fill="#3CB371"/>' +
        '<path d="M50 58 C60 54 70 60 68 70 C64 80 54 86 46 84 C48 76 42 66 50 58 Z" fill="#3CB371"/>' +
        '<ellipse cx="50" cy="50" rx="18" ry="40" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.5"/>' +
        '<path d="M10 50 H90" stroke="#FFFFFF" stroke-width="1.5" opacity="0.5"/>',
    ),
  },

  /* ---------- party ---------- */
  {
    id: 'cake',
    cat: 'party',
    svg: svg(
      '<rect x="12" y="56" width="76" height="32" rx="6" fill="#FFB0D0" stroke="#E63E87" stroke-width="3"/>' +
        '<rect x="22" y="36" width="56" height="22" rx="5" fill="#FFF0F6" stroke="#E63E87" stroke-width="3"/>' +
        '<path d="M22 44 Q28 52 34 44 Q40 52 46 44 Q52 52 58 44 Q64 52 70 44 Q74 50 78 44" fill="none" stroke="#FF8FC1" stroke-width="3"/>' +
        '<rect x="33" y="20" width="5" height="16" rx="2" fill="#4DB5FF"/><rect x="48" y="18" width="5" height="18" rx="2" fill="#FFD60A"/><rect x="63" y="20" width="5" height="16" rx="2" fill="#7FE3CF"/>' +
        '<ellipse cx="35.5" cy="15" rx="3.5" ry="5" fill="#FFB000"/><ellipse cx="50.5" cy="13" rx="3.5" ry="5" fill="#FFB000"/><ellipse cx="65.5" cy="15" rx="3.5" ry="5" fill="#FFB000"/>' +
        '<circle cx="28" cy="72" r="3" fill="#FFFFFF"/><circle cx="50" cy="74" r="3" fill="#FFFFFF"/><circle cx="72" cy="72" r="3" fill="#FFFFFF"/>',
    ),
  },
  {
    id: 'gift',
    cat: 'party',
    svg: svg(
      '<ellipse cx="38" cy="24" rx="13" ry="9" fill="#FFD60A" stroke="#F2A900" stroke-width="3" transform="rotate(-25 38 24)"/>' +
        '<ellipse cx="62" cy="24" rx="13" ry="9" fill="#FFD60A" stroke="#F2A900" stroke-width="3" transform="rotate(25 62 24)"/>' +
        '<rect x="14" y="46" width="72" height="42" rx="5" fill="#8B6CF6" stroke="#6A4BE0" stroke-width="3"/>' +
        '<rect x="10" y="32" width="80" height="16" rx="4" fill="#A48BFF" stroke="#6A4BE0" stroke-width="3"/>' +
        '<rect x="45" y="32" width="10" height="56" fill="#FFD60A"/>',
    ),
  },
  {
    id: 'partyhat',
    cat: 'party',
    svg: svg(
      '<path d="M50 12 L80 86 L20 86 Z" fill="#FF5FA2" stroke="#E63E87" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M38 42 L62 42 M30 62 L70 62" stroke="#FFFFFF" stroke-width="6" opacity="0.8"/>' +
        '<circle cx="50" cy="10" r="8" fill="#FFD60A" stroke="#F2A900" stroke-width="2"/>' +
        '<circle cx="42" cy="76" r="3" fill="#4DB5FF"/><circle cx="58" cy="52" r="3" fill="#4DB5FF"/><circle cx="56" cy="76" r="3" fill="#7FE3CF"/>' +
        '<path d="M16 86 Q50 96 84 86" fill="none" stroke="#E63E87" stroke-width="4" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'confetti',
    cat: 'party',
    svg: svg(
      '<rect x="14" y="16" width="10" height="5" rx="2" fill="#FF5FA2" transform="rotate(30 19 18)"/>' +
        '<rect x="62" y="12" width="10" height="5" rx="2" fill="#4DB5FF" transform="rotate(-20 67 14)"/>' +
        '<rect x="40" y="40" width="10" height="5" rx="2" fill="#FFD60A" transform="rotate(60 45 42)"/>' +
        '<rect x="78" y="48" width="10" height="5" rx="2" fill="#7FE3CF" transform="rotate(15 83 50)"/>' +
        '<rect x="20" y="70" width="10" height="5" rx="2" fill="#8B6CF6" transform="rotate(-40 25 72)"/>' +
        '<rect x="56" y="80" width="10" height="5" rx="2" fill="#FF8A3D" transform="rotate(25 61 82)"/>' +
        '<circle cx="34" cy="26" r="3.5" fill="#7FE3CF"/><circle cx="86" cy="24" r="3.5" fill="#FF5FA2"/><circle cx="18" cy="46" r="3.5" fill="#4DB5FF"/>' +
        '<circle cx="64" cy="60" r="3.5" fill="#FF5FA2"/><circle cx="40" cy="88" r="3.5" fill="#FFD60A"/><circle cx="88" cy="84" r="3.5" fill="#8B6CF6"/>' +
        '<path d="M44 14 q4 4 0 8 q-4 4 0 8" stroke="#FF8A3D" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M70 30 q4 4 0 8 q-4 4 0 8" stroke="#8B6CF6" stroke-width="3" fill="none" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'music',
    cat: 'party',
    svg: svg(
      '<path d="M34 76 V24 L82 12 V64" stroke="#3B2A4A" stroke-width="6" fill="none" stroke-linejoin="round"/>' +
        '<path d="M34 36 L82 24" stroke="#3B2A4A" stroke-width="8"/>' +
        '<ellipse cx="25" cy="77" rx="12" ry="9" fill="#8B6CF6" stroke="#3B2A4A" stroke-width="3" transform="rotate(-20 25 77)"/>' +
        '<ellipse cx="73" cy="65" rx="12" ry="9" fill="#FF5FA2" stroke="#3B2A4A" stroke-width="3" transform="rotate(-20 73 65)"/>',
    ),
  },

  /* ---------- nature ---------- */
  {
    id: 'daisy',
    cat: 'nature',
    svg: svg(petals(12, 8, 20, 24, '#FFFFFF', '#D9D9D9') + '<circle cx="50" cy="50" r="13" fill="#FFC107" stroke="#F2A900" stroke-width="3"/><circle cx="46" cy="46" r="3" fill="#FFE082"/>'),
  },
  {
    id: 'sakura',
    cat: 'nature',
    svg: svg(
      petals(5, 15, 21, 20, '#FFC1D9', '#FF8FB8') +
        '<circle cx="50" cy="50" r="8" fill="#FF8FB8"/>' +
        '<circle cx="50" cy="38" r="2.5" fill="#E8577B"/><circle cx="61" cy="47" r="2.5" fill="#E8577B"/><circle cx="57" cy="60" r="2.5" fill="#E8577B"/><circle cx="43" cy="60" r="2.5" fill="#E8577B"/><circle cx="39" cy="47" r="2.5" fill="#E8577B"/>',
    ),
  },
  {
    id: 'rose',
    cat: 'nature',
    svg: svg(
      '<path d="M50 94 Q48 76 50 62" stroke="#388E3C" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M50 80 Q30 66 22 78 Q34 86 50 80 Z" fill="#66BB6A" stroke="#388E3C" stroke-width="2"/>' +
        '<path d="M50 74 Q70 60 78 72 Q66 80 50 74 Z" fill="#66BB6A" stroke="#388E3C" stroke-width="2"/>' +
        '<circle cx="50" cy="38" r="26" fill="#E53950" stroke="#B71C3C" stroke-width="3"/>' +
        '<path d="M50 38 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0" fill="none" stroke="#B71C3C" stroke-width="3" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'leaf',
    cat: 'nature',
    svg: svg(
      '<path d="M16 84 C16 42 48 14 88 12 C88 54 60 84 16 84 Z" fill="#66BB6A" stroke="#388E3C" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M16 84 C40 62 60 40 80 20 M36 66 L34 48 M50 52 L50 36 M36 66 L54 66 M50 52 L66 52" stroke="#388E3C" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'moon',
    cat: 'nature',
    svg: svg(
      '<path d="M60 8 A42 42 0 1 0 92 70 A34 34 0 1 1 60 8 Z" fill="#FFE08A" stroke="#F2A900" stroke-width="3" stroke-linejoin="round"/>' +
        sparkle(74, 26, 9, '#FFD60A') +
        sparkle(86, 46, 5, '#FFD60A') +
        '<circle cx="40" cy="62" r="2.6" fill="#3B2A4A"/><path d="M28 70 Q34 76 40 70" stroke="#3B2A4A" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'cactus',
    cat: 'nature',
    svg: svg(
      '<path d="M28 70 H72 L66 94 H34 Z" fill="#E0874D" stroke="#B8622E" stroke-width="3" stroke-linejoin="round"/>' +
        '<rect x="24" y="64" width="52" height="10" rx="3" fill="#F09B5F" stroke="#B8622E" stroke-width="3"/>' +
        '<rect x="36" y="16" width="28" height="50" rx="14" fill="#66BB6A" stroke="#388E3C" stroke-width="3"/>' +
        '<path d="M36 46 H24 Q18 46 18 40 V30" stroke="#388E3C" stroke-width="10" fill="none" stroke-linecap="round"/>' +
        '<path d="M64 38 H76 Q82 38 82 32 V24" stroke="#388E3C" stroke-width="10" fill="none" stroke-linecap="round"/>' +
        eyes(50, 38, 6) +
        '<path d="M46 46 Q50 50 54 46" stroke="#3B2A4A" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '<circle cx="50" cy="13" r="5" fill="#FF8FC1"/>',
    ),
  },

  /* ---------- decor ---------- */
  {
    id: 'tapepink',
    cat: 'decor',
    svg: svg(
      '<g transform="rotate(-10 50 50)"><path d="M6 36 L94 36 L90 42 L94 48 L90 54 L94 60 L94 64 L6 64 L10 58 L6 52 L10 46 L6 40 Z" fill="#FFB0C8" fill-opacity="0.85"/>' +
        '<path d="M18 36 L10 64 M34 36 L26 64 M50 36 L42 64 M66 36 L58 64 M82 36 L74 64" stroke="#FFFFFF" stroke-width="4" opacity="0.55"/></g>',
    ),
  },
  {
    id: 'tapemint',
    cat: 'decor',
    svg: svg(
      '<g transform="rotate(8 50 50)"><path d="M6 36 L94 36 L90 42 L94 48 L90 54 L94 60 L94 64 L6 64 L10 58 L6 52 L10 46 L6 40 Z" fill="#9FE3CF" fill-opacity="0.85"/>' +
        '<circle cx="22" cy="44" r="3" fill="#FFFFFF" opacity="0.8"/><circle cx="38" cy="56" r="3" fill="#FFFFFF" opacity="0.8"/><circle cx="54" cy="44" r="3" fill="#FFFFFF" opacity="0.8"/>' +
        '<circle cx="70" cy="56" r="3" fill="#FFFFFF" opacity="0.8"/><circle cx="84" cy="44" r="3" fill="#FFFFFF" opacity="0.8"/></g>',
    ),
  },
  {
    id: 'bubble',
    cat: 'decor',
    svg: svg(
      '<path d="M18 14 H82 Q92 14 92 24 V58 Q92 68 82 68 H46 L28 86 L31 68 H18 Q8 68 8 58 V24 Q8 14 18 14 Z" fill="#FFFFFF" stroke="#3B2A4A" stroke-width="3" stroke-linejoin="round"/>' +
        heartAt(38, 28, 0.25, '#FF5FA2', '#E63E87', 2),
    ),
  },
  {
    id: 'stardoodle',
    cat: 'decor',
    svg: svg(
      '<polygon points="50,10 61,38 91,39 67,57 76,86 50,69 24,86 33,57 9,39 39,38" fill="none" stroke="#FFB000" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<path d="M88 12 L94 6 M84 6 L84 0 M92 18 L98 18" stroke="#FFB000" stroke-width="3" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'arrow',
    cat: 'decor',
    svg: svg(
      '<path d="M10 74 C24 40 44 86 56 58 C64 40 52 32 46 42 C40 52 60 60 84 30" stroke="#3B2A4A" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M84 30 L72 32 M84 30 L82 42" stroke="#3B2A4A" stroke-width="4" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'sparkles',
    cat: 'decor',
    svg: svg(sparkle(40, 52, 32, '#FFD60A') + sparkle(78, 22, 14, '#FFB000') + sparkle(80, 76, 10, '#FFE082')),
  },
  {
    id: 'banner',
    cat: 'decor',
    svg: svg(
      '<path d="M4 40 H20 V66 H4 L12 53 Z" fill="#E8577B"/><path d="M96 40 H80 V66 H96 L88 53 Z" fill="#E8577B"/>' +
        '<path d="M20 60 L26 66 V58 Z M80 60 L74 66 V58 Z" fill="#B71C3C"/>' +
        '<rect x="14" y="32" width="72" height="28" rx="3" fill="#FF8FB8" stroke="#E8577B" stroke-width="3"/>' +
        heartAt(41, 37, 0.2, '#FFFFFF', '#FFFFFF', 1),
    ),
  },

  /* ---------- cute ---------- */
  {
    id: 'coffee',
    cat: 'cute',
    svg: svg(
      '<path d="M40 22 Q36 14 42 8 M52 22 Q48 14 54 8" stroke="#BCAAA4" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="46" cy="86" rx="38" ry="7" fill="#D7CCC8" stroke="#A1887F" stroke-width="3"/>' +
        '<path d="M14 30 H78 V60 Q78 82 46 82 Q14 82 14 60 Z" fill="#FFFFFF" stroke="#8D6E63" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M78 40 Q94 40 92 54 Q90 66 76 64" fill="none" stroke="#8D6E63" stroke-width="5"/>' +
        '<ellipse cx="46" cy="32" rx="30" ry="5" fill="#8D5A2B"/>' +
        heartAt(37, 48, 0.2, '#FF8FB8', '#E8577B', 2),
    ),
  },
  {
    id: 'bear',
    cat: 'cute',
    svg: svg(
      '<circle cx="22" cy="26" r="14" fill="#B07A50" stroke="#7A4E2D" stroke-width="3"/><circle cx="78" cy="26" r="14" fill="#B07A50" stroke="#7A4E2D" stroke-width="3"/>' +
        '<circle cx="22" cy="26" r="7" fill="#E8B48A"/><circle cx="78" cy="26" r="7" fill="#E8B48A"/>' +
        '<circle cx="50" cy="56" r="38" fill="#B07A50" stroke="#7A4E2D" stroke-width="3"/>' +
        '<ellipse cx="50" cy="68" rx="16" ry="12" fill="#E8B48A"/><ellipse cx="50" cy="62" rx="6" ry="4.5" fill="#3B2A4A"/>' +
        eyes(50, 48, 14) +
        '<path d="M44 72 Q50 77 56 72" stroke="#3B2A4A" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="26" cy="62" r="5" fill="#FF8FC1" opacity="0.7"/><circle cx="74" cy="62" r="5" fill="#FF8FC1" opacity="0.7"/>',
    ),
  },
  {
    id: 'cat',
    cat: 'cute',
    svg: svg(
      '<path d="M14 48 L18 8 L44 30 Z" fill="#FFB866" stroke="#D98E2B" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M86 48 L82 8 L56 30 Z" fill="#FFB866" stroke="#D98E2B" stroke-width="3" stroke-linejoin="round"/>' +
        '<ellipse cx="50" cy="58" rx="40" ry="34" fill="#FFB866" stroke="#D98E2B" stroke-width="3"/>' +
        '<path d="M44 26 L46 36 M56 26 L54 36" stroke="#D98E2B" stroke-width="3" stroke-linecap="round"/>' +
        eyes(50, 54, 14) +
        '<path d="M47 62 L53 62 L50 66 Z" fill="#FF8FC1"/>' +
        '<path d="M50 66 Q46 72 42 68 M50 66 Q54 72 58 68" stroke="#3B2A4A" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M8 58 L28 62 M8 68 L28 66 M92 58 L72 62 M92 68 L72 66" stroke="#7A4E2D" stroke-width="2" stroke-linecap="round"/>',
    ),
  },
  {
    id: 'paw',
    cat: 'cute',
    svg: svg(
      '<path d="M50 50 C66 50 80 62 80 76 C80 88 68 90 60 86 C54 84 46 84 40 86 C32 90 20 88 20 76 C20 62 34 50 50 50 Z" fill="#FF8FC1" stroke="#E8577B" stroke-width="3"/>' +
        '<ellipse cx="20" cy="42" rx="9" ry="12" fill="#FF8FC1" stroke="#E8577B" stroke-width="3" transform="rotate(-20 20 42)"/>' +
        '<ellipse cx="38" cy="24" rx="9" ry="12" fill="#FF8FC1" stroke="#E8577B" stroke-width="3" transform="rotate(-6 38 24)"/>' +
        '<ellipse cx="62" cy="24" rx="9" ry="12" fill="#FF8FC1" stroke="#E8577B" stroke-width="3" transform="rotate(6 62 24)"/>' +
        '<ellipse cx="80" cy="42" rx="9" ry="12" fill="#FF8FC1" stroke="#E8577B" stroke-width="3" transform="rotate(20 80 42)"/>',
    ),
  },
];
