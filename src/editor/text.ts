import type { SkFont } from '@shopify/react-native-skia';

import type { TextLayer } from './types';

/**
 * Text on photos: the fonts (every one has Vietnamese and Spanish accents), the looks, and ready-made designs
 * ("Mẫu chữ"). Fonts are loaded twice: by Skia to draw on the photo (useEditorFonts) and by expo-font for the
 * previews in the panel (family names below).
 */
export const TEXT_FONTS = [
  { id: 'baloo', family: 'Baloo2_700Bold', file: require('@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf') },
  { id: 'dancing', family: 'DancingScript_700Bold', file: require('@expo-google-fonts/dancing-script/700Bold/DancingScript_700Bold.ttf') },
  { id: 'vibes', family: 'GreatVibes_400Regular', file: require('@expo-google-fonts/great-vibes/400Regular/GreatVibes_400Regular.ttf') },
  { id: 'pacifico', family: 'Pacifico_400Regular', file: require('@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf') },
  { id: 'lobster', family: 'Lobster_400Regular', file: require('@expo-google-fonts/lobster/400Regular/Lobster_400Regular.ttf') },
  { id: 'playfair', family: 'PlayfairDisplay_700Bold_Italic', file: require('@expo-google-fonts/playfair-display/700Bold_Italic/PlayfairDisplay_700Bold_Italic.ttf') },
  { id: 'oswald', family: 'Oswald_600SemiBold', file: require('@expo-google-fonts/oswald/600SemiBold/Oswald_600SemiBold.ttf') },
  { id: 'hand', family: 'PatrickHand_400Regular', file: require('@expo-google-fonts/patrick-hand/400Regular/PatrickHand_400Regular.ttf') },
] as const;

export type FontId = (typeof TEXT_FONTS)[number]['id'];
export const DEFAULT_FONT: FontId = 'baloo';
export const fontInfo = (id: FontId | undefined) => TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0];

/** sticker: white border (the original look) · plain · outline: dark border · shadow: soft drop shadow. Labels: text.style.<id>. */
export const TEXT_STYLES = ['sticker', 'plain', 'outline', 'shadow'] as const;
export type TextStyleId = (typeof TEXT_STYLES)[number];
export const DEFAULT_TEXT_STYLE: TextStyleId = 'sticker';

/** One SkFont per font id; null while it loads. */
export type EditorFonts = Partial<Record<FontId, SkFont | null>>;

/** The font a layer is drawn with (falls back to Baloo while its own font loads). */
export const fontOf = (fonts: EditorFonts, layer: Pick<TextLayer, 'font'>) => fonts[layer.font ?? DEFAULT_FONT] ?? fonts[DEFAULT_FONT] ?? null;

export const linesOf = (text: string) => text.split('\n');

/** Fonts are loaded at BASE size and scaled per layer. */
export const LINE_GAP = 1.08;

/** Size of the text block at the font's base size: widest line × all lines. */
export function textBlock(font: SkFont | null, text: string, baseSize: number) {
  const lines = linesOf(text);
  if (!font) return { width: Math.max(...lines.map((l) => l.length)) * baseSize * 0.5, lineHeight: baseSize * 1.2, lines, center: baseSize * 0.35 };
  const m = font.getMetrics();
  const lineHeight = (m.descent - m.ascent) * LINE_GAP;
  // Baseline that puts the line's ink box (ascent → descent) around y = 0.
  const center = -(m.ascent + m.descent) / 2;
  return { width: Math.max(...lines.map((l) => font.getTextWidth(l)), 1), lineHeight, lines, center };
}

/* ---------- Ready-made designs ---------- */

export const TEXT_CATEGORIES = ['all', 'love', 'travel', 'vintage', 'phrases', 'party'] as const;
export type TextCategory = (typeof TEXT_CATEGORIES)[number];

type DesignLang = 'es' | 'en' | 'pt' | 'vi';
export type TextDesign = { id: string; cat: Exclude<TextCategory, 'all'>; font: FontId; style: TextStyleId; color: string; text: Record<DesignLang, string> };

const same = (s: string, vi = s) => ({ es: s, en: s, pt: s, vi });

export const TEXT_DESIGNS: TextDesign[] = [
  { id: 'love', cat: 'love', font: 'vibes', style: 'plain', color: '#E8577B', text: same('Love', 'Yêu') },
  { id: 'teamo', cat: 'love', font: 'pacifico', style: 'sticker', color: '#E23E57', text: { es: 'Te amo', en: 'I love you', pt: 'Te amo', vi: 'Thương lắm' } },
  { id: 'favorite', cat: 'love', font: 'dancing', style: 'plain', color: '#C2185B', text: { es: 'Mi persona\nfavorita', en: 'My favorite\nperson', pt: 'Minha pessoa\nfavorita', vi: 'Người thương\ncủa tôi' } },
  { id: 'forever', cat: 'love', font: 'vibes', style: 'shadow', color: '#FFFFFF', text: { es: 'Juntos\npor siempre', en: 'Together\nforever', pt: 'Juntos\npara sempre', vi: 'Mãi bên nhau' } },
  { id: 'xoxo', cat: 'love', font: 'lobster', style: 'sticker', color: '#FF6FA5', text: same('XOXO') },
  { id: 'travel', cat: 'travel', font: 'dancing', style: 'plain', color: '#2E7D9A', text: { es: 'Viaje', en: 'Travel', pt: 'Viagem', vi: 'Du lịch' } },
  { id: 'vacation', cat: 'travel', font: 'pacifico', style: 'sticker', color: '#FF8A3D', text: { es: 'Modo\nvacaciones', en: 'Vacation\nmode', pt: 'Modo\nférias', vi: 'Chế độ\nđi chơi' } },
  { id: 'beach', cat: 'travel', font: 'lobster', style: 'sticker', color: '#1E88E5', text: { es: 'Hola, playa', en: 'Hello, beach', pt: 'Olá, praia', vi: 'Xin chào biển' } },
  { id: 'explore', cat: 'travel', font: 'oswald', style: 'shadow', color: '#FFFFFF', text: { es: 'EXPLORA\nEL MUNDO', en: 'EXPLORE\nTHE WORLD', pt: 'EXPLORE\nO MUNDO', vi: 'KHÁM PHÁ\nTHẾ GIỚI' } },
  { id: 'wanderlust', cat: 'travel', font: 'vibes', style: 'plain', color: '#6D4C41', text: same('Wanderlust', 'Đi để trở về') },
  { id: 'vintage', cat: 'vintage', font: 'playfair', style: 'plain', color: '#8D6E63', text: same('Vintage', 'Hoài niệm') },
  { id: 'memories', cat: 'vintage', font: 'playfair', style: 'shadow', color: '#FFF3E0', text: { es: 'Recuerdos', en: 'Memories', pt: 'Memórias', vi: 'Kỷ niệm' } },
  { id: 'est', cat: 'vintage', font: 'oswald', style: 'plain', color: '#3E2723', text: { es: 'EST. 2026', en: 'EST. 2026', pt: 'EST. 2026', vi: 'TỪ 2026' } },
  { id: 'madewithlove', cat: 'vintage', font: 'hand', style: 'plain', color: '#6D4C41', text: { es: 'Hecho con amor', en: 'Made with love', pt: 'Feito com amor', vi: 'Làm bằng cả trái tim' } },
  { id: 'goodmorning', cat: 'phrases', font: 'vibes', style: 'shadow', color: '#FFFFFF', text: { es: 'Buenos\nDías', en: 'Good\nMorning', pt: 'Bom\nDia', vi: 'Chào\nbuổi sáng' } },
  { id: 'smile', cat: 'phrases', font: 'dancing', style: 'plain', color: '#D81B60', text: { es: 'Sonríe\nsiempre', en: 'Always\nsmile', pt: 'Sorria\nsempre', vi: 'Luôn\nmỉm cười' } },
  { id: 'today', cat: 'phrases', font: 'hand', style: 'sticker', color: '#3E2723', text: { es: 'La vida\nes hoy', en: 'Life is\nnow', pt: 'A vida\né agora', vi: 'Sống trọn\nhôm nay' } },
  { id: 'vibes', cat: 'phrases', font: 'pacifico', style: 'sticker', color: '#F9A825', text: { es: 'Buenas vibras', en: 'Good vibes', pt: 'Boas vibes', vi: 'Vui lên nào' } },
  { id: 'blessed', cat: 'phrases', font: 'vibes', style: 'plain', color: '#8E24AA', text: { es: 'Bendecida', en: 'Blessed', pt: 'Abençoada', vi: 'Bình an' } },
  { id: 'ican', cat: 'phrases', font: 'oswald', style: 'outline', color: '#FFFFFF', text: { es: 'YO PUEDO', en: 'I CAN', pt: 'EU CONSIGO', vi: 'MÌNH LÀM ĐƯỢC' } },
  { id: 'family', cat: 'phrases', font: 'dancing', style: 'sticker', color: '#6D4C41', text: { es: 'Mi familia', en: 'My family', pt: 'Minha família', vi: 'Gia đình tôi' } },
  { id: 'birthday', cat: 'party', font: 'pacifico', style: 'sticker', color: '#FF5FA2', text: { es: 'Feliz\ncumpleaños', en: 'Happy\nbirthday', pt: 'Feliz\naniversário', vi: 'Chúc mừng\nsinh nhật' } },
  { id: 'party', cat: 'party', font: 'lobster', style: 'sticker', color: '#7E57C2', text: { es: '¡Fiesta!', en: 'Party!', pt: 'Festa!', vi: 'Tiệc thôi!' } },
  { id: 'congrats', cat: 'party', font: 'dancing', style: 'shadow', color: '#FFB300', text: { es: 'Felicidades', en: 'Congrats', pt: 'Parabéns', vi: 'Chúc mừng' } },
  { id: 'christmas', cat: 'party', font: 'vibes', style: 'sticker', color: '#C62828', text: { es: 'Feliz\nNavidad', en: 'Merry\nChristmas', pt: 'Feliz\nNatal', vi: 'Giáng sinh\nvui vẻ' } },
];

/** The design's text in the app language (English for languages without their own wording). */
export const designText = (d: TextDesign, lang: string) => d.text[(['es', 'en', 'pt', 'vi'].includes(lang) ? lang : 'en') as DesignLang];
