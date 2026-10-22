import type { CamFilter } from './registry';

/** The second set of 30 CamIA Filters (the first is in registry.ts); merged there, category by category. */
export const moreFilters: CamFilter[] = [
  // ---- Natural & Selfie ----
  {
    id: 'softdaylight',
    name: 'Soft Daylight',
    category: 'natural',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -4, highlights: -22, shadows: 26, whites: -6 },
      color: { temperature: 2, vibrance: 14 },
      curves: { rgb: [0.03, 0.28, 0.53, 0.78, 0.99] },
    },
  },
  {
    id: 'sunkissed',
    name: 'Sun Kissed',
    category: 'natural',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -8, highlights: -14 },
      color: { temperature: 26, tint: 10 },
      curves: { rgb: [0.06, 0.3, 0.55, 0.8, 0.98] },
      beauty: { glow: 28 },
      split: { highlightHue: 30, highlightSat: 30 },
    },
  },
  {
    id: 'crispmorning',
    name: 'Crisp Morning',
    category: 'natural',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: 18, highlights: -14 },
      color: { temperature: -22, tint: 4, saturation: -6 },
      split: { shadowHue: 210, shadowSat: 20 },
      detail: { clarity: 24 },
    },
  },

  // ---- Beauty & Glow ----
  {
    id: 'roseglow',
    name: 'Rose Glow',
    category: 'beauty',
    intensity: 80,
    recipe: {
      light: { exposure: 8 },
      color: { temperature: 4, tint: 16 },
      beauty: { rosy: 45, glow: 30, smooth: 20 },
      split: { highlightHue: 350, highlightSat: 22 },
    },
  },
  {
    id: 'porcelain',
    name: 'Porcelain',
    category: 'beauty',
    intensity: 80,
    recipe: {
      light: { exposure: 14, contrast: -6 },
      color: { temperature: -6, saturation: -26 },
      curves: { rgb: [0.06, 0.31, 0.57, 0.81, 1] },
      hsl: { orange: { sat: -20, lum: 16 } },
      beauty: { smooth: 35, brighten: 30 },
    },
  },
  {
    id: 'bronzed',
    name: 'Bronzed Glow',
    category: 'beauty',
    intensity: 80,
    recipe: {
      light: { contrast: 18, highlights: -12 },
      color: { temperature: 20, tint: -4 },
      hsl: { orange: { hue: -4, sat: 22, lum: -18 } },
      beauty: { glow: 25 },
      split: { shadowHue: 25, shadowSat: 25, highlightHue: 35, highlightSat: 30 },
    },
  },

  // ---- Cinematic ----
  {
    id: 'neonnoir',
    name: 'Neon Noir',
    category: 'cinematic',
    intensity: 80,
    recipe: {
      light: { contrast: 24, blacks: -14 },
      color: { temperature: -10, tint: 20, saturation: 10 },
      split: { shadowHue: 200, shadowSat: 45, highlightHue: 320, highlightSat: 35 },
      detail: { vignette: 25 },
    },
  },
  {
    id: 'desertepic',
    name: 'Desert Epic',
    category: 'cinematic',
    intensity: 80,
    recipe: {
      light: { contrast: 10, highlights: -20 },
      color: { temperature: 28, tint: -2, saturation: -30 },
      curves: { rgb: [0.1, 0.3, 0.52, 0.74, 0.92] },
      hsl: { blue: { hue: 30, sat: -60 }, orange: { sat: 10 } },
      split: { shadowHue: 30, shadowSat: 30, highlightHue: 45, highlightSat: 20 },
      detail: { clarity: 10, vignette: 15 },
    },
  },

  // ---- Vintage & Film ----
  {
    id: 'instant70s',
    name: 'Instant 70s',
    category: 'vintage',
    intensity: 85,
    recipe: {
      color: { temperature: 18, tint: -18, saturation: -20 },
      curves: { rgb: [0.15, 0.35, 0.55, 0.75, 0.9], r: [0.06, 0.29, 0.53, 0.77, 1] },
      split: { shadowHue: 170, shadowSat: 35, highlightHue: 55, highlightSat: 32 },
      detail: { grain: 22, vignette: 25 },
    },
  },
  {
    id: 'oldsepia',
    name: 'Old Sepia',
    category: 'vintage',
    intensity: 90,
    recipe: {
      color: { saturation: -80 },
      curves: { rgb: [0.08, 0.3, 0.52, 0.74, 0.92] },
      split: { shadowHue: 25, shadowSat: 40, highlightHue: 35, highlightSat: 50 },
      detail: { grain: 30, vignette: 35 },
    },
  },

  // ---- Korean & Japanese ----
  {
    id: 'tokyonight',
    name: 'Tokyo Night',
    category: 'asian',
    intensity: 80,
    recipe: {
      light: { exposure: -8, contrast: 20 },
      color: { temperature: -30, tint: 22, saturation: 14 },
      hsl: { blue: { hue: -10, sat: 24 }, magenta: { sat: 24 } },
      split: { shadowHue: 235, shadowSat: 55, highlightHue: 315, highlightSat: 40 },
    },
  },
  {
    id: 'seoulpeach',
    name: 'Seoul Peach',
    category: 'asian',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -12 },
      color: { temperature: 18, tint: 6, saturation: -8 },
      curves: { rgb: [0.05, 0.3, 0.55, 0.8, 0.99] },
      hsl: { orange: { sat: -4, lum: 12 } },
      beauty: { brighten: 20 },
      split: { shadowHue: 200, shadowSat: 14, highlightHue: 25, highlightSat: 30 },
    },
  },

  // ---- Instagram Aesthetic ----
  {
    id: 'mintcream',
    name: 'Mint Cream',
    category: 'aesthetic',
    intensity: 80,
    recipe: {
      light: { exposure: 10 },
      color: { temperature: -6, tint: -14, saturation: -14 },
      curves: { rgb: [0.08, 0.3, 0.55, 0.79, 0.97] },
      split: { shadowHue: 160, shadowSat: 28, highlightHue: 60, highlightSat: 14 },
    },
  },
  {
    id: 'dreamyhaze',
    name: 'Dreamy Haze',
    category: 'aesthetic',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: -24 },
      color: { temperature: 10, tint: 20, saturation: -6 },
      curves: { rgb: [0.14, 0.36, 0.58, 0.8, 0.96] },
      beauty: { glow: 45 },
      split: { highlightHue: 345, highlightSat: 22 },
    },
  },

  // ---- Summer & Beach ----
  {
    id: 'tropicalpop',
    name: 'Tropical Pop',
    category: 'summer',
    intensity: 80,
    recipe: {
      light: { contrast: 18 },
      color: { temperature: -4, saturation: 18, vibrance: 50 },
      hsl: { green: { hue: -10, sat: 45 }, aqua: { hue: 8, sat: 45 }, yellow: { sat: 25 }, blue: { sat: 20 } },
      detail: { clarity: 14 },
    },
  },
  {
    id: 'poolside',
    name: 'Poolside',
    category: 'summer',
    intensity: 80,
    recipe: {
      light: { exposure: 14, contrast: -6 },
      color: { temperature: -6, tint: -12 },
      curves: { rgb: [0.06, 0.3, 0.56, 0.81, 1] },
      hsl: { aqua: { hue: -10, sat: 55, lum: 14 }, blue: { hue: -12, sat: 35, lum: 12 }, orange: { sat: 12, lum: 6 } },
      split: { shadowHue: 175, shadowSat: 30 },
    },
  },

  // ---- Dark & Moody ----
  {
    id: 'burgundy',
    name: 'Burgundy Mood',
    category: 'moody',
    intensity: 85,
    recipe: {
      light: { exposure: -8, contrast: 20, blacks: -10 },
      color: { tint: 26, saturation: -20 },
      hsl: { red: { hue: -6, sat: 30, lum: -10 }, magenta: { sat: 10 } },
      split: { shadowHue: 330, shadowSat: 45, highlightHue: 20, highlightSat: 12 },
      detail: { vignette: 30 },
    },
  },
  {
    id: 'stormygrey',
    name: 'Stormy Grey',
    category: 'moody',
    intensity: 85,
    recipe: {
      light: { exposure: -6, contrast: 18, highlights: -24 },
      color: { temperature: -14, saturation: -50 },
      split: { shadowHue: 210, shadowSat: 25 },
      detail: { clarity: 20, vignette: 25 },
    },
  },

  // ---- Luxury & Fashion ----
  {
    id: 'champagne',
    name: 'Champagne',
    category: 'luxury',
    intensity: 80,
    recipe: {
      light: { exposure: 8, contrast: 14 },
      color: { temperature: 14, saturation: -24 },
      curves: { rgb: [0.05, 0.29, 0.54, 0.79, 0.98] },
      beauty: { glow: 15 },
      split: { shadowHue: 30, shadowSat: 15, highlightHue: 48, highlightSat: 38 },
    },
  },
  {
    id: 'blackonyx',
    name: 'Black Onyx',
    category: 'luxury',
    intensity: 80,
    recipe: {
      light: { contrast: 34, highlights: -10, blacks: -24 },
      color: { temperature: -4, saturation: -30 },
      curves: { rgb: [0, 0.18, 0.48, 0.8, 1] },
      split: { shadowHue: 220, shadowSat: 16 },
      detail: { clarity: 20, vignette: 30 },
    },
  },
  {
    id: 'rosegold',
    name: 'Rose Gold',
    category: 'luxury',
    intensity: 80,
    recipe: {
      light: { contrast: 22, blacks: -10 },
      color: { temperature: 10, tint: 24, saturation: -20 },
      curves: { rgb: [0.05, 0.28, 0.53, 0.78, 0.98] },
      beauty: { glow: 12 },
      split: { shadowHue: 300, shadowSat: 30, highlightHue: 15, highlightSat: 45 },
    },
  },
  {
    id: 'milanvogue',
    name: 'Milan Vogue',
    category: 'luxury',
    intensity: 85,
    recipe: {
      light: { exposure: 4, contrast: 26, blacks: -8 },
      color: { temperature: 2, saturation: -45 },
      curves: { rgb: [0.03, 0.24, 0.5, 0.8, 1] },
      hsl: { red: { sat: 30 }, orange: { sat: 10 } },
      detail: { grain: 10 },
    },
  },

  // ---- Food & Travel ----
  {
    id: 'freshgreens',
    name: 'Fresh Greens',
    category: 'foodtravel',
    intensity: 80,
    recipe: {
      light: { exposure: 10, contrast: 16, highlights: -12, shadows: 12 },
      color: { temperature: 6, tint: -8, vibrance: 24 },
      hsl: { green: { hue: -10, sat: 55, lum: 12 }, yellow: { hue: -16, sat: 26 } },
      split: { shadowHue: 120, shadowSat: 30, highlightHue: 70, highlightSat: 18 },
      detail: { clarity: 22 },
    },
  },
  {
    id: 'coffeeshop',
    name: 'Coffee Shop',
    category: 'foodtravel',
    intensity: 85,
    recipe: {
      light: { exposure: -6, contrast: 16 },
      color: { temperature: 24, saturation: -26 },
      curves: { rgb: [0.08, 0.27, 0.5, 0.73, 0.92] },
      hsl: { orange: { sat: 10, lum: -8 } },
      split: { shadowHue: 25, shadowSat: 40, highlightHue: 35, highlightSat: 20 },
      detail: { vignette: 25, grain: 12 },
    },
  },
  {
    id: 'citybreak',
    name: 'City Break',
    category: 'foodtravel',
    intensity: 80,
    recipe: {
      light: { contrast: 26, highlights: -20, shadows: 10 },
      color: { temperature: -24, tint: -6, saturation: -35 },
      curves: { rgb: [0.04, 0.22, 0.48, 0.77, 0.97] },
      split: { shadowHue: 195, shadowSat: 45, highlightHue: 45, highlightSat: 18 },
      detail: { clarity: 30 },
    },
  },
  {
    id: 'sweetdessert',
    name: 'Sweet Dessert',
    category: 'foodtravel',
    intensity: 80,
    recipe: {
      light: { exposure: 12, contrast: 6, highlights: -12 },
      color: { temperature: 6, tint: 10, vibrance: 20 },
      curves: { rgb: [0.04, 0.29, 0.55, 0.8, 1] },
      hsl: { red: { sat: 14, lum: 8 }, magenta: { sat: 16 } },
    },
  },

  // ---- Portrait & Studio ----
  {
    id: 'warmportrait',
    name: 'Warm Portrait',
    category: 'portrait',
    intensity: 80,
    recipe: {
      light: { exposure: 8, contrast: 10, highlights: -12, shadows: 10 },
      color: { temperature: 22, tint: 6 },
      hsl: { orange: { sat: 10, lum: 10 } },
      beauty: { smooth: 30, brighten: 20 },
      split: { highlightHue: 35, highlightSat: 20 },
      detail: { vignette: 20 },
    },
  },
  {
    id: 'silverportrait',
    name: 'Silver Portrait',
    category: 'portrait',
    intensity: 100,
    recipe: {
      light: { exposure: 6, contrast: 18, highlights: -14, shadows: 12 },
      color: { saturation: -100 },
      curves: { rgb: [0.05, 0.27, 0.52, 0.79, 0.98] },
      beauty: { smooth: 20 },
      split: { highlightHue: 40, highlightSat: 12 },
      detail: { vignette: 18 },
    },
  },
  {
    id: 'lowkey',
    name: 'Low Key',
    category: 'portrait',
    intensity: 85,
    recipe: {
      light: { exposure: -12, contrast: 30, highlights: -6, shadows: -20, blacks: -18 },
      color: { temperature: 6, saturation: -10 },
      detail: { clarity: 10, vignette: 40 },
    },
  },
  {
    id: 'highkey',
    name: 'High Key',
    category: 'portrait',
    intensity: 80,
    recipe: {
      light: { exposure: 22, contrast: -10, highlights: -6, whites: 16, blacks: 14 },
      color: { saturation: -12 },
      curves: { rgb: [0.08, 0.34, 0.6, 0.84, 1] },
      beauty: { brighten: 20 },
    },
  },
];
