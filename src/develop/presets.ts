import type { FilterId } from '../editor/filters';
import type { PhotoKey } from '../photos';
import { defaultDevelop, hslRanges, type CurveChannel, type Develop, type HslRange } from './types';
import { t, type MessageKey } from '../i18n';
import { morePresets } from './presetsMore';

export const presetCategories = [
  { id: 'portrait', label: 'presetCat.portrait' },
  { id: 'latino', label: 'presetCat.latino' },
  { id: 'tropical', label: 'presetCat.tropical' },
  { id: 'cine', label: 'presetCat.cine' },
  { id: 'vintage', label: 'presetCat.vintage' },
  { id: 'aesthetic', label: 'presetCat.aesthetic' },
  { id: 'food', label: 'presetCat.food' },
  { id: 'landscape', label: 'presetCat.landscape' },
  { id: 'night', label: 'presetCat.night' },
  { id: 'bw', label: 'presetCat.bw' },
] as const;

export type PresetCategory = (typeof presetCategories)[number]['id'];

type DevelopPatch = {
  light?: Partial<Develop['light']>;
  color?: Partial<Develop['color']>;
  curves?: Partial<Record<CurveChannel, number[]>>;
  hsl?: Partial<Record<HslRange, Partial<Develop['hsl'][HslRange]>>>;
  detail?: Partial<Develop['detail']>;
  /** Color look layered on top (e.g. sepia); applied whenever the preset is on. */
  look?: FilterId;
};

export type DevelopPreset = {
  id: string;
  name: string;
  categories: PresetCategory[];
  /** Built-in presets: sample photo for the card and the changes from neutral. */
  photo?: PhotoKey;
  patch?: DevelopPatch;
  /** The user's own recipes ("Công thức của tôi"): full settings plus a thumbnail made from their photo. */
  develop?: Develop;
  thumb?: string;
  custom?: boolean;
};

/** The first set of looks; the second set is in presetsMore.ts. */
const firstSet: DevelopPreset[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    categories: ['cine', 'portrait'],
    photo: 'cinematic',
    patch: {
      light: { contrast: 20, highlights: -25, shadows: 15, blacks: -10 },
      color: { temperature: 8, saturation: -10, vibrance: 10 },
      curves: { r: [0, 0.22, 0.5, 0.79, 1], b: [0.06, 0.29, 0.5, 0.71, 0.95] },
      hsl: { orange: { sat: 10 }, blue: { hue: -10 } },
      detail: { clarity: 15, vignette: 20 },
    },
  },
  {
    id: 'softglow',
    name: 'Soft Glow',
    categories: ['portrait', 'aesthetic'],
    photo: 'modelPeace',
    patch: {
      light: { exposure: 8, contrast: -20, highlights: -10, shadows: 20, blacks: 10 },
      color: { temperature: 12, saturation: -5, vibrance: 15 },
      curves: { rgb: [0.06, 0.28, 0.53, 0.78, 0.97] },
      hsl: { orange: { lum: 10 } },
      detail: { clarity: -25, vignette: -15 },
    },
  },
  {
    id: 'mocha',
    name: 'Mocha',
    categories: ['aesthetic', 'vintage', 'food'],
    photo: 'coffee',
    patch: {
      light: { contrast: 10, highlights: -20, shadows: 10 },
      color: { temperature: 25, tint: 5, saturation: -25 },
      curves: { rgb: [0.08, 0.27, 0.5, 0.73, 0.92], r: [0, 0.27, 0.53, 0.77, 1], b: [0, 0.21, 0.45, 0.7, 0.92] },
      hsl: { orange: { hue: -10 }, green: { sat: -40 } },
      detail: { grain: 15, vignette: 20 },
    },
  },
  {
    id: 'retrosun',
    name: 'Retro Sun',
    categories: ['vintage', 'cine'],
    photo: 'vintage',
    patch: {
      light: { exposure: 5, contrast: 15, highlights: -15 },
      color: { temperature: 35, tint: 10, saturation: 10 },
      curves: { rgb: [0.1, 0.3, 0.52, 0.76, 0.95], r: [0.04, 0.28, 0.55, 0.8, 1], b: [0, 0.2, 0.45, 0.7, 0.88] },
      detail: { grain: 25, vignette: 25 },
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    categories: ['bw', 'cine'],
    photo: 'modelWhite',
    patch: {
      light: { contrast: 45, highlights: -10, shadows: -15, whites: 15, blacks: -25 },
      color: { saturation: -100 },
      curves: { rgb: [0.02, 0.2, 0.5, 0.8, 1] },
      detail: { clarity: 30, grain: 20, vignette: 35 },
    },
  },
  {
    id: 'goldenhour',
    name: 'Golden Hour',
    categories: ['portrait', 'aesthetic'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 5, highlights: -15, shadows: 15 },
      color: { temperature: 30, tint: 4, vibrance: 25 },
      hsl: { orange: { sat: 15 }, yellow: { sat: 10 }, blue: { sat: -10 } },
      detail: { vignette: 15 },
    },
  },
  {
    id: 'blockbuster',
    name: 'Blockbuster',
    categories: ['cine'],
    photo: 'modelWhite',
    patch: {
      light: { contrast: 30, blacks: -15 },
      color: { temperature: -5, saturation: -5 },
      curves: { b: [0.08, 0.3, 0.5, 0.7, 0.92] },
      hsl: { blue: { hue: -15, sat: 10 }, aqua: { hue: -20 }, orange: { sat: 10 } },
      detail: { clarity: 20, vignette: 25 },
    },
  },
  {
    id: 'film98',
    name: 'Film 98',
    categories: ['vintage'],
    photo: 'dog',
    patch: {
      color: { temperature: 10, tint: -5, saturation: -20 },
      curves: { rgb: [0.12, 0.3, 0.5, 0.72, 0.9] },
      hsl: { green: { hue: 15 } },
      detail: { grain: 35 },
    },
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    categories: ['aesthetic'],
    photo: 'lake',
    patch: {
      light: { exposure: 10, contrast: -30, shadows: 30 },
      color: { tint: 8, saturation: -20, vibrance: 10 },
      curves: { rgb: [0.12, 0.33, 0.56, 0.8, 0.98] },
      hsl: { magenta: { lum: 10 } },
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    categories: ['bw'],
    photo: 'hat',
    patch: {
      light: { contrast: 10 },
      color: { saturation: -100 },
      curves: { rgb: [0.04, 0.25, 0.5, 0.75, 0.97] },
    },
  },
  {
    id: 'silver',
    name: 'Silver',
    categories: ['bw'],
    photo: 'modelVanity',
    patch: {
      light: { contrast: 60, whites: 20, blacks: -30 },
      color: { saturation: -100 },
      detail: { clarity: 40, sharpness: 20 },
    },
  },
  {
    id: 'cleanportrait',
    name: 'Clean Portrait',
    categories: ['portrait'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 5, highlights: -10, shadows: 15 },
      color: { vibrance: 10 },
      hsl: { orange: { lum: 12, sat: -5 } },
      detail: { clarity: -10, sharpness: 20 },
    },
  },

  /* ---------- Latin America ---------- */
  {
    id: 'cancun',
    name: 'Cancún',
    categories: ['tropical', 'landscape'],
    photo: 'tulum',
    patch: {
      light: { exposure: 8, contrast: 10, highlights: -20, shadows: 15 },
      color: { temperature: 10, vibrance: 30 },
      hsl: { aqua: { sat: 30, lum: 5 }, blue: { sat: 20, hue: -8 }, orange: { sat: 8, lum: 6 } },
      detail: { clarity: 10 },
    },
  },
  {
    id: 'havana',
    name: 'Havana',
    categories: ['latino', 'vintage'],
    photo: 'havana',
    patch: {
      light: { contrast: -10, highlights: -15 },
      color: { temperature: 18, tint: 6, saturation: -10 },
      curves: { rgb: [0.1, 0.3, 0.52, 0.75, 0.93], g: [0.02, 0.26, 0.5, 0.74, 0.97] },
      hsl: { aqua: { hue: -10, sat: 15 }, red: { sat: 10 }, yellow: { sat: 10 } },
      detail: { grain: 30, vignette: 20 },
    },
  },
  {
    id: 'tulum',
    name: 'Tulum',
    categories: ['latino', 'tropical', 'aesthetic'],
    photo: 'modelPeace',
    patch: {
      light: { exposure: 6, contrast: -15, shadows: 20 },
      color: { temperature: 14, saturation: -25, vibrance: 5 },
      curves: { rgb: [0.08, 0.28, 0.52, 0.77, 0.95] },
      hsl: { green: { sat: -40, lum: -5 }, orange: { lum: 8 }, blue: { sat: -30 } },
      detail: { clarity: -10, grain: 10 },
    },
  },
  {
    id: 'mariachi',
    name: 'Mariachi',
    categories: ['latino', 'cine'],
    photo: 'modelWhite',
    patch: {
      light: { contrast: 30, highlights: -10, blacks: -15 },
      color: { temperature: 12, saturation: 15 },
      hsl: { red: { sat: 30, lum: -5 }, orange: { sat: 10 }, yellow: { sat: 20, hue: -5 } },
      detail: { clarity: 15, vignette: 30 },
    },
  },
  {
    id: 'frida',
    name: 'Frida',
    categories: ['latino'],
    photo: 'modelVanity',
    patch: {
      light: { contrast: 20 },
      color: { saturation: 15, vibrance: 40 },
      hsl: { blue: { sat: 35 }, red: { sat: 30 }, yellow: { sat: 30 }, green: { sat: 20 }, orange: { sat: -5 } },
      detail: { clarity: 10 },
    },
  },
  {
    id: 'rio',
    name: 'Río',
    categories: ['tropical', 'latino'],
    photo: 'copacabana',
    patch: {
      light: { exposure: 10, contrast: 15, highlights: -25, shadows: 10 },
      color: { temperature: 15, vibrance: 35 },
      hsl: { aqua: { sat: 25, hue: -5 }, blue: { sat: 20 }, orange: { sat: 12, lum: 5 }, yellow: { sat: 15 } },
      detail: { clarity: 12 },
    },
  },
  {
    id: 'carnaval',
    name: 'Carnaval',
    categories: ['latino'],
    photo: 'modelPeace',
    patch: {
      light: { contrast: 30, whites: 10, blacks: -10 },
      color: { saturation: 35, vibrance: 25 },
      hsl: { magenta: { sat: 30 }, purple: { sat: 25 }, yellow: { sat: 25 } },
      detail: { clarity: 20 },
    },
  },
  {
    id: 'telenovela',
    name: 'Telenovela',
    categories: ['latino', 'portrait'],
    photo: 'modelWhite',
    patch: {
      light: { exposure: 6, contrast: -10, highlights: -15, shadows: 15 },
      color: { temperature: 10, tint: 10, vibrance: 12 },
      curves: { rgb: [0.04, 0.27, 0.53, 0.78, 0.98] },
      hsl: { orange: { lum: 12, sat: -5 }, red: { lum: 5 } },
      detail: { clarity: -30, vignette: -10 },
    },
  },
  {
    id: 'medellin',
    name: 'Medellín',
    categories: ['latino', 'aesthetic'],
    photo: 'lake',
    patch: {
      light: { exposure: 8, highlights: -10, shadows: 20 },
      color: { temperature: -4, vibrance: 20 },
      hsl: { green: { sat: 25, lum: 8, hue: -5 }, yellow: { hue: -8 }, orange: { lum: 5 } },
      detail: { clarity: 10 },
    },
  },
  {
    id: 'cartagena',
    name: 'Cartagena',
    categories: ['latino'],
    photo: 'cartagena',
    patch: {
      light: { contrast: 15, highlights: -10 },
      color: { temperature: 10, vibrance: 30 },
      hsl: { orange: { sat: 25 }, yellow: { sat: 30 }, magenta: { sat: 25 }, red: { sat: 15 }, blue: { sat: 15 } },
      detail: { clarity: 15, vignette: 10 },
    },
  },
  {
    id: 'oaxaca',
    name: 'Oaxaca',
    categories: ['latino'],
    photo: 'modelWhite',
    patch: {
      light: { contrast: 15, highlights: -20 },
      color: { temperature: 25, saturation: -10 },
      curves: { r: [0.02, 0.28, 0.55, 0.78, 1], b: [0, 0.2, 0.44, 0.7, 0.9] },
      hsl: { orange: { hue: -8, sat: 15 }, red: { hue: 8 }, green: { sat: -30 } },
      detail: { grain: 15, vignette: 20 },
    },
  },
  {
    id: 'patagonia',
    name: 'Patagonia',
    categories: ['cine', 'landscape'],
    photo: 'patagonia',
    patch: {
      light: { contrast: 20, highlights: -20, shadows: 10 },
      color: { temperature: -15, saturation: -5, vibrance: 15 },
      hsl: { blue: { sat: 20, lum: -8 }, aqua: { sat: 15 }, green: { sat: -10 } },
      detail: { clarity: 30, sharpness: 20 },
    },
  },
  {
    id: 'atardecer',
    name: 'Atardecer',
    categories: ['tropical', 'aesthetic', 'landscape'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 5, highlights: -20 },
      color: { temperature: 35, tint: 12, vibrance: 20 },
      curves: { r: [0.03, 0.28, 0.55, 0.8, 1], b: [0.05, 0.24, 0.47, 0.72, 0.92] },
      hsl: { orange: { sat: 20 }, magenta: { sat: 20 } },
      detail: { vignette: 20 },
    },
  },
  {
    id: 'bossanova',
    name: 'Bossa Nova',
    categories: ['vintage', 'latino'],
    photo: 'hat',
    patch: {
      light: { contrast: -15 },
      color: { temperature: 15, saturation: -20 },
      curves: { rgb: [0.12, 0.32, 0.53, 0.75, 0.92] },
      hsl: { aqua: { hue: 10 }, green: { hue: 15, sat: -15 } },
      detail: { grain: 30, vignette: 15 },
    },
  },
  {
    id: 'salsa',
    name: 'Salsa',
    categories: ['latino'],
    photo: 'modelVanity',
    patch: {
      light: { contrast: 25, blacks: -10 },
      color: { temperature: 15, saturation: 20 },
      hsl: { red: { sat: 25 }, orange: { sat: 20, lum: -5 }, blue: { sat: -20 } },
      detail: { clarity: 15, vignette: 15 },
    },
  },
  {
    id: 'caribe',
    name: 'Caribe',
    categories: ['tropical'],
    photo: 'coast',
    patch: {
      light: { exposure: 8, highlights: -15, shadows: 10 },
      color: { temperature: 6, vibrance: 30 },
      hsl: { aqua: { sat: 35, hue: -10 }, blue: { sat: 15, hue: -12 }, green: { hue: -10, sat: 10 } },
      detail: { clarity: 8 },
    },
  },
  {
    id: 'pieldorada',
    name: 'Piel Dorada',
    categories: ['portrait', 'latino'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 5, highlights: -10, shadows: 15 },
      color: { temperature: 15, tint: 4, vibrance: 10 },
      hsl: { orange: { sat: 15, lum: 8, hue: -3 }, red: { sat: 5 } },
      detail: { clarity: -10 },
    },
  },
  {
    id: 'nochelatina',
    name: 'Noche Latina',
    categories: ['latino', 'cine', 'night'],
    photo: 'cinematic',
    patch: {
      light: { exposure: -8, contrast: 25, highlights: -10, blacks: -20 },
      color: { temperature: -10, tint: 15, saturation: 10 },
      curves: { b: [0.08, 0.3, 0.52, 0.74, 0.95] },
      hsl: { magenta: { sat: 30 }, purple: { sat: 25 }, blue: { sat: 15 } },
      detail: { vignette: 35, grain: 10 },
    },
  },
  {
    id: 'polaroid80',
    name: 'Polaroid 80s',
    categories: ['vintage'],
    photo: 'dog',
    patch: {
      light: { contrast: -20, highlights: -10 },
      color: { temperature: 8, tint: -8, saturation: -15 },
      curves: { rgb: [0.12, 0.32, 0.52, 0.74, 0.9], g: [0.05, 0.27, 0.51, 0.75, 0.97] },
      detail: { grain: 25, vignette: 20 },
    },
  },
  {
    id: 'cafecolombia',
    name: 'Café de Colombia',
    categories: ['latino', 'aesthetic', 'food'],
    photo: 'coffee',
    patch: {
      light: { contrast: 10, highlights: -15 },
      color: { temperature: 22, saturation: -30 },
      curves: { rgb: [0.07, 0.27, 0.5, 0.73, 0.92] },
      hsl: { orange: { hue: -6, lum: -5 }, green: { sat: -40 } },
      detail: { grain: 12 },
    },
  },
  {
    id: 'cinedeoro',
    name: 'Cine de Oro',
    categories: ['bw', 'latino', 'vintage'],
    photo: 'modelWhite',
    patch: {
      look: 'vintage',
      light: { contrast: 35, blacks: -20 },
      detail: { clarity: 20, grain: 25, vignette: 30 },
    },
  },
];

export const developPresets: DevelopPreset[] = [...firstSet, ...morePresets];

export const presetById = (id: string) => developPresets.find((p) => p.id === id);

/** One-line description in the app's language (the user's own recipes share one). */
export const presetDescription = (p: DevelopPreset) => (p.custom ? t('recipe.description') : t(`preset.${p.id}` as MessageKey));

const linear = [0, 0.25, 0.5, 0.75, 1];

/** The preset as full develop settings, blended from neutral by intensity (0–100). */
export function presetDevelop(preset: DevelopPreset, intensity = 100): Develop {
  const t = intensity / 100;
  if (preset.develop) return scaleDevelop(preset.develop, t);
  const d = defaultDevelop();
  const patch = preset.patch ?? {};
  for (const [k, v] of Object.entries(patch.light ?? {})) d.light[k as keyof Develop['light']] = Math.round(v * t);
  for (const [k, v] of Object.entries(patch.color ?? {})) d.color[k as keyof Develop['color']] = Math.round(v * t);
  for (const [k, v] of Object.entries(patch.detail ?? {})) d.detail[k as keyof Develop['detail']] = Math.round(v * t);
  for (const [k, pts] of Object.entries(patch.curves ?? {})) {
    d.curves[k as CurveChannel] = pts.map((y, i) => linear[i] + (y - linear[i]) * t);
  }
  if (patch.look && t > 0) d.look = patch.look;
  for (const r of hslRanges) {
    const p = patch.hsl?.[r.id];
    if (p) d.hsl[r.id] = { hue: Math.round((p.hue ?? 0) * t), sat: Math.round((p.sat ?? 0) * t), lum: Math.round((p.lum ?? 0) * t) };
  }
  return d;
}

const mix = (from: number, to: number, t: number) => Math.round(from + (to - from) * t);

/** Full develop settings blended from neutral (t = 0) to the given settings (t = 1). */
export function scaleDevelop(target: Develop, t: number): Develop {
  const d = defaultDevelop();
  const scaleGroup = <T extends Record<string, number>>(base: T, to: T) =>
    Object.fromEntries(Object.entries(base).map(([k, v]) => [k, mix(v, to[k] ?? v, t)])) as T;
  return {
    light: scaleGroup(d.light, target.light),
    color: scaleGroup(d.color, target.color),
    detail: scaleGroup(d.detail, target.detail),
    beauty: scaleGroup(d.beauty, target.beauty ?? d.beauty),
    curves: Object.fromEntries(
      Object.entries(d.curves).map(([ch, pts]) => [ch, pts.map((y, i) => y + ((target.curves[ch as CurveChannel]?.[i] ?? y) - y) * t)]),
    ) as Develop['curves'],
    hsl: Object.fromEntries(hslRanges.map((r) => [r.id, scaleGroup(d.hsl[r.id], target.hsl[r.id] ?? d.hsl[r.id])])) as Develop['hsl'],
    look: t > 0 ? target.look : 'none',
  };
}
