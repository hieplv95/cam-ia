import type { DevelopPatch } from '../develop/patch';
import { moreFilters } from './registryMore';

/**
 * CamIA Filters: color filters made of real color recipes (tone, white balance, curves, HSL, split toning, film
 * grain…) run by the develop shader on the device. Nothing is sent anywhere and switching costs nothing.
 * Names are the same in every language (like the presets); the categories are translated (filters.cat.<id>).
 * Kept free of React Native imports so tests/filters.test.ts can check every filter on real photos.
 */
export const filterCategories = [
  'natural',
  'beauty',
  'cinematic',
  'vintage',
  'asian',
  'aesthetic',
  'summer',
  'moody',
  'luxury',
  'foodtravel',
  'portrait',
] as const;

export type FilterCategory = (typeof filterCategories)[number];

export type CamFilter = {
  id: string;
  name: string;
  category: FilterCategory;
  /** Strength the filter opens at (0–100); the user can change it. */
  intensity: number;
  recipe: DevelopPatch;
};

/** The first set; the second is in registryMore.ts. */
const firstSet: CamFilter[] = [
  // ---- Natural & Selfie ----
  {
    id: 'fresh',
    name: 'Fresh Natural',
    category: 'natural',
    intensity: 80,
    recipe: {
      light: { exposure: 8, contrast: 14, highlights: -20, shadows: 22 },
      color: { temperature: 8, vibrance: 30 },
      hsl: { orange: { sat: -4, lum: 6 }, green: { sat: 12 } },
      detail: { clarity: 14 },
    },
  },
  {
    id: 'cleanwhite',
    name: 'Clean White',
    category: 'natural',
    intensity: 80,
    recipe: {
      light: { exposure: 16, contrast: -6, highlights: -12, shadows: 20, whites: 12, blacks: 8 },
      color: { temperature: -8, saturation: -16, vibrance: 6 },
      curves: { rgb: [0.04, 0.29, 0.55, 0.8, 1] },
    },
  },
  {
    id: 'warmbeige',
    name: 'Warm Beige',
    category: 'natural',
    intensity: 85,
    recipe: {
      light: { exposure: 4, contrast: -10, shadows: 12 },
      color: { temperature: 22, tint: 4, saturation: -28 },
      curves: { rgb: [0.07, 0.29, 0.52, 0.77, 0.96] },
      hsl: { orange: { sat: -10 }, green: { sat: -45 }, blue: { sat: -40 } },
      split: { shadowHue: 30, shadowSat: 30, highlightHue: 40, highlightSat: 22 },
    },
  },

  // ---- Beauty & Glow ----
  {
    id: 'honeyglow',
    name: 'Honey Glow',
    category: 'beauty',
    intensity: 80,
    recipe: {
      light: { exposure: 8, contrast: 6, highlights: -6, shadows: 10 },
      color: { temperature: 22, tint: 6, vibrance: 14 },
      hsl: { orange: { sat: 10, lum: 6 } },
      beauty: { glow: 35, smooth: 25, brighten: 20 },
      split: { shadowHue: 25, shadowSat: 12, highlightHue: 40, highlightSat: 30 },
    },
  },
  {
    id: 'creamyskin',
    name: 'Creamy Skin',
    category: 'beauty',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -10, highlights: -15, shadows: 12 },
      color: { temperature: 12, tint: 4, saturation: -12 },
      curves: { rgb: [0.05, 0.28, 0.53, 0.78, 0.98] },
      hsl: { orange: { sat: -12, lum: 10 }, red: { sat: -10 } },
      beauty: { smooth: 45, even: 30, brighten: 25 },
    },
  },
  {
    id: 'softpeach',
    name: 'Soft Peach',
    category: 'beauty',
    intensity: 80,
    recipe: {
      light: { exposure: 8, contrast: -6, shadows: 10 },
      color: { temperature: 14, tint: 18, vibrance: 6 },
      curves: { r: [0.04, 0.28, 0.54, 0.79, 1] },
      beauty: { rosy: 50, smooth: 20 },
      split: { shadowHue: 340, shadowSat: 14, highlightHue: 15, highlightSat: 34 },
    },
  },

  // ---- Cinematic ----
  {
    id: 'tealorange',
    name: 'Teal & Orange',
    category: 'cinematic',
    intensity: 80,
    recipe: {
      light: { contrast: 20, highlights: -15, shadows: 8, blacks: -8 },
      color: { temperature: 4, saturation: -6, vibrance: 12 },
      hsl: { orange: { sat: 18, lum: 4 }, aqua: { hue: -10, sat: 14 }, blue: { hue: -12, sat: 8 }, green: { hue: 30, sat: -30 } },
      split: { shadowHue: 190, shadowSat: 50, highlightHue: 30, highlightSat: 40 },
      detail: { vignette: 15 },
    },
  },
  {
    id: 'deepcontrast',
    name: 'Deep Contrast',
    category: 'cinematic',
    intensity: 75,
    recipe: {
      light: { contrast: 40, highlights: -10, shadows: -12, whites: 8, blacks: -20 },
      color: { saturation: -10, vibrance: 6 },
      curves: { rgb: [0, 0.2, 0.5, 0.82, 1] },
      detail: { clarity: 25, vignette: 20 },
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Cine',
    category: 'cinematic',
    intensity: 80,
    recipe: {
      light: { exposure: -10, contrast: 22, highlights: -20 },
      color: { temperature: -26, tint: 4, saturation: -20 },
      curves: { rgb: [0.05, 0.22, 0.48, 0.76, 0.95] },
      split: { shadowHue: 225, shadowSat: 50, highlightHue: 205, highlightSat: 14 },
      detail: { vignette: 30, grain: 10 },
    },
  },

  // ---- Vintage & Film ----
  {
    id: 'vintage90s',
    name: 'Vintage 90s',
    category: 'vintage',
    intensity: 85,
    recipe: {
      light: { contrast: 10 },
      color: { temperature: 16, tint: 8, saturation: -10 },
      curves: { rgb: [0.09, 0.31, 0.52, 0.75, 0.93], r: [0.04, 0.27, 0.52, 0.78, 1], b: [0.1, 0.28, 0.5, 0.72, 0.88] },
      hsl: { green: { hue: 15, sat: -20 } },
      detail: { grain: 35, vignette: 22 },
    },
  },
  {
    id: 'retrokodak',
    name: 'Retro Kodak',
    category: 'vintage',
    intensity: 85,
    recipe: {
      light: { contrast: 14, highlights: -14 },
      color: { temperature: 18, tint: -4, saturation: 8, vibrance: 10 },
      curves: { rgb: [0.06, 0.27, 0.51, 0.76, 0.96], r: [0.03, 0.28, 0.55, 0.8, 1], g: [0.03, 0.27, 0.51, 0.76, 0.98], b: [0.08, 0.24, 0.45, 0.68, 0.88] },
      hsl: { yellow: { sat: 22 }, red: { sat: 14 }, blue: { hue: -8, sat: -14 } },
      split: { shadowHue: 70, shadowSat: 22 },
      detail: { grain: 22 },
    },
  },
  {
    id: 'sunsetfilm',
    name: 'Sunset Film',
    category: 'vintage',
    intensity: 80,
    recipe: {
      light: { contrast: 8, highlights: -14 },
      color: { temperature: 30, tint: 18, saturation: 6 },
      curves: { rgb: [0.08, 0.29, 0.52, 0.77, 0.96] },
      split: { shadowHue: 285, shadowSat: 32, highlightHue: 25, highlightSat: 42 },
      detail: { grain: 15, vignette: 18 },
    },
  },

  // ---- Korean & Japanese ----
  {
    id: 'koreanmilk',
    name: 'Korean Milk',
    category: 'asian',
    intensity: 80,
    recipe: {
      light: { exposure: 14, contrast: -14, highlights: -12, shadows: 22, blacks: 10 },
      color: { temperature: -4, tint: 4, saturation: -18 },
      curves: { rgb: [0.08, 0.32, 0.57, 0.8, 0.98] },
      hsl: { orange: { sat: -10, lum: 12 } },
      beauty: { smooth: 25, brighten: 20 },
    },
  },
  {
    id: 'japanfilm',
    name: 'Japanese Film',
    category: 'asian',
    intensity: 85,
    recipe: {
      light: { exposure: 8, contrast: -6, highlights: -18 },
      color: { temperature: -12, tint: -10, saturation: -12 },
      curves: { rgb: [0.07, 0.29, 0.53, 0.77, 0.95], g: [0.03, 0.27, 0.52, 0.77, 1], b: [0.07, 0.28, 0.51, 0.74, 0.95] },
      hsl: { green: { hue: 20, sat: -10, lum: 8 }, blue: { hue: -10, sat: -18 } },
      split: { shadowHue: 170, shadowSat: 24 },
      detail: { grain: 12 },
    },
  },
  {
    id: 'fujigreen',
    name: 'Fuji Green',
    category: 'asian',
    intensity: 85,
    recipe: {
      light: { contrast: 18, shadows: 6 },
      color: { temperature: -4, tint: -20, saturation: 4 },
      curves: { g: [0.05, 0.28, 0.52, 0.76, 0.98], b: [0.05, 0.27, 0.5, 0.74, 0.96] },
      hsl: { green: { hue: -8, sat: 30, lum: -6 }, yellow: { hue: -14, sat: 8 }, aqua: { sat: 14 }, orange: { sat: -6 } },
      split: { shadowHue: 150, shadowSat: 45, highlightHue: 55, highlightSat: 16 },
      detail: { grain: 10 },
    },
  },

  // ---- Instagram Aesthetic ----
  {
    id: 'pinkblush',
    name: 'Pink Blush',
    category: 'aesthetic',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -8, shadows: 12 },
      color: { temperature: 10, tint: 24, saturation: -6 },
      curves: { rgb: [0.05, 0.29, 0.55, 0.79, 0.99] },
      beauty: { rosy: 30 },
      split: { shadowHue: 330, shadowSat: 18, highlightHue: 345, highlightSat: 30 },
    },
  },
  {
    id: 'coldblue',
    name: 'Cold Blue',
    category: 'aesthetic',
    intensity: 80,
    recipe: {
      light: { exposure: 4, contrast: 12, highlights: -10 },
      color: { temperature: -40, tint: -4, saturation: -10 },
      hsl: { orange: { sat: -22 }, blue: { sat: 18 } },
      split: { shadowHue: 215, shadowSat: 38, highlightHue: 195, highlightSat: 18 },
    },
  },
  {
    id: 'lavender',
    name: 'Lavender Haze',
    category: 'aesthetic',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -10, shadows: 14 },
      color: { temperature: -14, tint: 26, saturation: -16 },
      curves: { rgb: [0.08, 0.3, 0.55, 0.78, 0.97] },
      split: { shadowHue: 265, shadowSat: 36, highlightHue: 290, highlightSat: 18 },
    },
  },

  // ---- Summer & Beach ----
  {
    id: 'goldenhour',
    name: 'Golden Hour',
    category: 'summer',
    intensity: 85,
    recipe: {
      light: { exposure: 10, contrast: 10, highlights: -12, shadows: 18 },
      color: { temperature: 48, tint: 6, saturation: 8, vibrance: 25 },
      hsl: { orange: { sat: 14, lum: 4 }, yellow: { sat: 16 }, blue: { sat: -18 } },
      beauty: { glow: 28 },
      split: { shadowHue: 25, shadowSat: 22, highlightHue: 38, highlightSat: 48 },
      detail: { vignette: 12 },
    },
  },
  {
    id: 'summertan',
    name: 'Summer Tan',
    category: 'summer',
    intensity: 80,
    recipe: {
      light: { contrast: 18, highlights: -10, shadows: 6 },
      color: { temperature: 18, tint: 4, saturation: 10, vibrance: 15 },
      hsl: { orange: { hue: -4, sat: 20, lum: -14 }, red: { sat: 8 }, blue: { hue: -6, sat: 24 }, aqua: { sat: 22 } },
      detail: { clarity: 10 },
    },
  },
  {
    id: 'oceanbreeze',
    name: 'Ocean Breeze',
    category: 'summer',
    intensity: 80,
    recipe: {
      light: { exposure: 8, contrast: 8, highlights: -16, shadows: 12 },
      color: { temperature: -26, tint: -4, vibrance: 22 },
      hsl: { blue: { hue: -8, sat: 30, lum: 6 }, aqua: { hue: 8, sat: 30, lum: 8 }, green: { hue: 16, sat: 6 }, orange: { sat: 6, lum: 6 } },
      split: { shadowHue: 185, shadowSat: 34 },
    },
  },

  // ---- Dark & Moody ----
  {
    id: 'moodybrown',
    name: 'Moody Brown',
    category: 'moody',
    intensity: 85,
    recipe: {
      light: { exposure: -8, contrast: 18, highlights: -24, blacks: -10 },
      color: { temperature: 14, saturation: -28 },
      curves: { rgb: [0.05, 0.22, 0.46, 0.72, 0.92] },
      hsl: { green: { hue: -20, sat: -40 }, blue: { sat: -40 } },
      split: { shadowHue: 25, shadowSat: 30, highlightHue: 35, highlightSat: 18 },
      detail: { vignette: 30, grain: 10 },
    },
  },
  {
    id: 'darkforest',
    name: 'Dark Forest',
    category: 'moody',
    intensity: 85,
    recipe: {
      light: { exposure: -10, contrast: 20, highlights: -20, shadows: -8 },
      color: { temperature: -6, tint: -14, saturation: -16 },
      curves: { rgb: [0.04, 0.21, 0.47, 0.74, 0.95] },
      hsl: { green: { hue: -12, sat: -10, lum: -20 }, yellow: { hue: -20, sat: -10, lum: -12 }, orange: { sat: -10 } },
      split: { shadowHue: 150, shadowSat: 38 },
      detail: { vignette: 28, clarity: 12 },
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    category: 'moody',
    intensity: 100,
    recipe: {
      light: { contrast: 30, whites: 10, blacks: -15 },
      color: { saturation: -100 },
      curves: { rgb: [0.02, 0.2, 0.5, 0.82, 1] },
      detail: { clarity: 15, grain: 18, vignette: 25 },
    },
  },

  // ---- Luxury & Fashion ----
  {
    id: 'luxurygold',
    name: 'Luxury Gold',
    category: 'luxury',
    intensity: 80,
    recipe: {
      light: { contrast: 26, highlights: -12, blacks: -16 },
      color: { temperature: 24, tint: 2, saturation: -10 },
      hsl: { yellow: { sat: 12 }, orange: { sat: 6 }, blue: { sat: -40 }, green: { sat: -40 } },
      split: { shadowHue: 35, shadowSat: 30, highlightHue: 45, highlightSat: 50 },
      detail: { clarity: 12, vignette: 22 },
    },
  },
  {
    id: 'parisedit',
    name: 'Paris Editorial',
    category: 'luxury',
    intensity: 85,
    recipe: {
      light: { exposure: 6, contrast: 18, highlights: -16, shadows: 10, blacks: 6 },
      color: { temperature: -2, saturation: -40 },
      curves: { rgb: [0.07, 0.27, 0.52, 0.79, 0.97] },
      hsl: { red: { sat: 24 }, orange: { sat: 16 } },
      split: { shadowHue: 220, shadowSat: 16, highlightHue: 35, highlightSat: 8 },
      detail: { grain: 8 },
    },
  },

  // ---- Food & Travel ----
  {
    id: 'tasty',
    name: 'Tasty Warm',
    category: 'foodtravel',
    intensity: 80,
    recipe: {
      light: { exposure: 6, contrast: 14, shadows: 10 },
      color: { temperature: 12, saturation: 8, vibrance: 30 },
      hsl: { red: { sat: 15 }, orange: { sat: 14, lum: 4 }, yellow: { sat: 16 }, green: { sat: 12 } },
      detail: { clarity: 18, sharpness: 15 },
    },
  },
  {
    id: 'travelvivid',
    name: 'Travel Vivid',
    category: 'foodtravel',
    intensity: 80,
    recipe: {
      light: { contrast: 20, highlights: -28, shadows: 24 },
      color: { temperature: -6, saturation: 10, vibrance: 45 },
      hsl: { blue: { sat: 30, lum: -8 }, aqua: { sat: 20 }, green: { sat: 14 } },
      detail: { clarity: 28 },
    },
  },

  // ---- Portrait & Studio ----
  {
    id: 'studiosoft',
    name: 'Studio Soft',
    category: 'portrait',
    intensity: 80,
    recipe: {
      light: { exposure: 6, contrast: 10, highlights: -10, shadows: 10 },
      color: { temperature: -8, tint: 2, saturation: -4 },
      hsl: { orange: { sat: -6, lum: 6 } },
      beauty: { smooth: 30, brighten: 20 },
      detail: { vignette: -30, clarity: -6 },
    },
  },
  {
    id: 'matteportrait',
    name: 'Matte Portrait',
    category: 'portrait',
    intensity: 85,
    recipe: {
      light: { contrast: 6 },
      color: { temperature: -4, saturation: -20 },
      curves: { rgb: [0.14, 0.32, 0.53, 0.75, 0.9] },
      hsl: { orange: { sat: -6 } },
      split: { shadowHue: 210, shadowSat: 25, highlightHue: 35, highlightSat: 12 },
      detail: { vignette: 14 },
    },
  },
];

/** Every filter, grouped by category in the order of filterCategories (swiping goes through them in this order). */
export const camFilters: CamFilter[] = [...firstSet, ...moreFilters].sort(
  (a, b) => filterCategories.indexOf(a.category) - filterCategories.indexOf(b.category),
);

export const filterById = (id: string) => camFilters.find((f) => f.id === id);

export const filtersIn = (category: FilterCategory) => camFilters.filter((f) => f.category === category);
