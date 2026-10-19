import type { DevelopPreset } from './presets';

/**
 * The second set of looks: more portrait, Latin, tropical, film, vintage, aesthetic and black-and-white looks,
 * plus food, landscape and night. Same recipe format as presets.ts; descriptions are translations (preset.<id>).
 */
export const morePresets: DevelopPreset[] = [
  /* ---------- Portrait ---------- */
  {
    id: 'peach',
    name: 'Peach Skin',
    categories: ['portrait'],
    photo: 'modelPeace',
    patch: {
      light: { exposure: 6, contrast: -10, shadows: 15 },
      color: { temperature: 12, tint: 6, vibrance: 10 },
      hsl: { orange: { sat: 8, lum: 12 }, red: { lum: 6 } },
      detail: { clarity: -15 },
    },
  },
  {
    id: 'porcelain',
    name: 'Porcelain',
    categories: ['portrait', 'aesthetic'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 12, contrast: -15, highlights: -15, whites: 10 },
      color: { temperature: -6, saturation: -15 },
      hsl: { orange: { lum: 18, sat: -10 } },
      detail: { clarity: -25 },
    },
  },
  {
    id: 'rosyglow',
    name: 'Rosy Glow',
    categories: ['portrait'],
    photo: 'modelWhite',
    patch: {
      light: { exposure: 5, contrast: -8, shadows: 10 },
      color: { temperature: 6, tint: 12, vibrance: 12 },
      hsl: { red: { sat: 12 }, magenta: { sat: 10, lum: 8 }, orange: { lum: 8 } },
      detail: { clarity: -12, vignette: -10 },
    },
  },
  {
    id: 'studio',
    name: 'Studio Light',
    categories: ['portrait'],
    photo: 'modelPeace',
    patch: {
      light: { contrast: 18, highlights: -10, whites: 15, blacks: -10 },
      color: { vibrance: 8 },
      detail: { clarity: 15, sharpness: 25 },
    },
  },
  {
    id: 'moody',
    name: 'Moody',
    categories: ['portrait', 'cine'],
    photo: 'modelWhite',
    patch: {
      light: { exposure: -10, contrast: 15, highlights: -20, shadows: -10 },
      color: { temperature: -6, saturation: -25 },
      curves: { rgb: [0.06, 0.24, 0.48, 0.74, 0.95], b: [0.08, 0.29, 0.5, 0.7, 0.92] },
      detail: { clarity: 10, vignette: 30 },
    },
  },
  {
    id: 'kbeauty',
    name: 'K-Beauty',
    categories: ['portrait', 'aesthetic'],
    photo: 'modelWhite',
    patch: {
      light: { exposure: 14, contrast: -18, highlights: -10, shadows: 20 },
      color: { temperature: -5, tint: 6, saturation: -8 },
      curves: { rgb: [0.06, 0.29, 0.55, 0.79, 0.98] },
      hsl: { orange: { lum: 15, sat: -8 }, red: { lum: 6 } },
      detail: { clarity: -20 },
    },
  },

  /* ---------- Latin America ---------- */
  {
    id: 'cdmx',
    name: 'CDMX',
    categories: ['latino'],
    photo: 'cartagena',
    patch: {
      light: { contrast: 20, highlights: -10, blacks: -8 },
      color: { temperature: 12, vibrance: 20 },
      hsl: { red: { sat: 15 }, yellow: { sat: 15 }, blue: { sat: -10 } },
      detail: { clarity: 12 },
    },
  },
  {
    id: 'buenosaires',
    name: 'Buenos Aires',
    categories: ['latino', 'cine'],
    photo: 'havana',
    patch: {
      light: { contrast: 12, highlights: -15 },
      color: { temperature: -8, saturation: -25 },
      curves: { rgb: [0.08, 0.27, 0.5, 0.74, 0.95], b: [0.05, 0.28, 0.5, 0.72, 0.95] },
      detail: { grain: 15, vignette: 20 },
    },
  },
  {
    id: 'lima',
    name: 'Lima',
    categories: ['latino', 'aesthetic'],
    photo: 'coast',
    patch: {
      light: { exposure: 8, contrast: -20, shadows: 15 },
      color: { temperature: -3, saturation: -18 },
      curves: { rgb: [0.12, 0.31, 0.53, 0.76, 0.96] },
    },
  },
  {
    id: 'cusco',
    name: 'Cusco',
    categories: ['latino'],
    photo: 'patagonia',
    patch: {
      light: { contrast: 15, highlights: -15, shadows: 10 },
      color: { temperature: 18, vibrance: 15 },
      hsl: { red: { sat: 12 }, orange: { sat: 15 }, green: { sat: -30, hue: -10 } },
      detail: { clarity: 15, vignette: 15 },
    },
  },
  {
    id: 'bogota',
    name: 'Bogotá',
    categories: ['latino', 'cine'],
    photo: 'plant',
    patch: {
      light: { contrast: 10, highlights: -20, shadows: 5 },
      color: { temperature: -10, tint: -6, saturation: -10 },
      hsl: { green: { hue: 10, sat: -10, lum: -8 }, aqua: { sat: 10 } },
      detail: { vignette: 20 },
    },
  },
  {
    id: 'guadalajara',
    name: 'Guadalajara',
    categories: ['latino', 'tropical'],
    photo: 'tulum',
    patch: {
      light: { highlights: -15, shadows: 10 },
      color: { temperature: 18, tint: 12, vibrance: 25 },
      hsl: { magenta: { sat: 15 }, orange: { sat: 10 }, purple: { sat: 10 } },
      detail: { vignette: 15 },
    },
  },
  {
    id: 'quinceanera',
    name: 'Quinceañera',
    categories: ['latino', 'portrait'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 10, contrast: -15, shadows: 15 },
      color: { tint: 14, saturation: -5, vibrance: 10 },
      hsl: { magenta: { lum: 12, sat: 10 }, red: { lum: 8 } },
      detail: { clarity: -18, vignette: -12 },
    },
  },

  /* ---------- Tropical ---------- */
  {
    id: 'bahia',
    name: 'Bahía',
    categories: ['tropical'],
    photo: 'copacabana',
    patch: {
      light: { exposure: 5, highlights: -10, shadows: 10 },
      color: { temperature: 8, vibrance: 22 },
      hsl: { aqua: { sat: 25, lum: 8 }, blue: { sat: 15 }, orange: { sat: 8 } },
    },
  },
  {
    id: 'margarita',
    name: 'Isla Margarita',
    categories: ['tropical'],
    photo: 'coast',
    patch: {
      light: { exposure: 10, contrast: 8, whites: 10 },
      color: { temperature: -4, vibrance: 30 },
      hsl: { aqua: { hue: -10, sat: 30 }, blue: { sat: 20, lum: 5 } },
      detail: { clarity: 10 },
    },
  },
  {
    id: 'mango',
    name: 'Mango',
    categories: ['tropical', 'aesthetic'],
    photo: 'tulum',
    patch: {
      light: { exposure: 5, highlights: -10 },
      color: { temperature: 25, tint: 4, vibrance: 15 },
      hsl: { yellow: { sat: 20 }, orange: { sat: 15, lum: 5 } },
    },
  },
  {
    id: 'palmeras',
    name: 'Palmeras',
    categories: ['tropical', 'landscape'],
    photo: 'plant',
    patch: {
      light: { contrast: 12, shadows: 10 },
      color: { vibrance: 25 },
      hsl: { green: { hue: 15, sat: 20 }, aqua: { sat: 15 }, yellow: { hue: 10 } },
      detail: { clarity: 12 },
    },
  },
  {
    id: 'puntacana',
    name: 'Punta Cana',
    categories: ['tropical'],
    photo: 'copacabana',
    patch: {
      light: { exposure: 12, highlights: -15, whites: 15, shadows: 15 },
      color: { temperature: 5, vibrance: 20 },
      hsl: { aqua: { sat: 20, lum: 10 }, blue: { lum: 8 } },
    },
  },

  /* ---------- Film ---------- */
  {
    id: 'tealorange',
    name: 'Teal & Orange',
    categories: ['cine'],
    photo: 'cinematic',
    patch: {
      light: { contrast: 22, highlights: -15, blacks: -10 },
      color: { saturation: -5, vibrance: 10 },
      curves: { b: [0.1, 0.32, 0.5, 0.68, 0.9], r: [0, 0.22, 0.5, 0.78, 1] },
      hsl: { orange: { sat: 15 }, aqua: { hue: 10, sat: 15 }, blue: { hue: -15 }, green: { hue: 25, sat: -20 } },
      detail: { clarity: 15, vignette: 20 },
    },
  },
  {
    id: 'neonnoir',
    name: 'Neon Noir',
    categories: ['cine', 'night'],
    photo: 'modelWhite',
    patch: {
      light: { contrast: 30, blacks: -25, highlights: -10 },
      color: { tint: 15, vibrance: 20 },
      curves: { b: [0.08, 0.3, 0.52, 0.75, 1] },
      hsl: { magenta: { sat: 25 }, purple: { sat: 20 }, blue: { sat: 15 } },
      detail: { clarity: 10, vignette: 35 },
    },
  },
  {
    id: 'western',
    name: 'Western',
    categories: ['cine', 'vintage'],
    photo: 'patagonia',
    patch: {
      light: { contrast: 18, highlights: -20 },
      color: { temperature: 25, saturation: -30 },
      curves: { rgb: [0.06, 0.27, 0.5, 0.75, 0.95] },
      hsl: { yellow: { hue: -10 }, orange: { sat: 10 } },
      detail: { clarity: 20, grain: 20, vignette: 25 },
    },
  },
  {
    id: 'greencode',
    name: 'Green Code',
    categories: ['cine'],
    photo: 'modelVanity',
    patch: {
      light: { contrast: 20, blacks: -15 },
      color: { temperature: -8, tint: -15, saturation: -20 },
      curves: { g: [0.03, 0.27, 0.53, 0.77, 0.98] },
      detail: { clarity: 15, vignette: 25 },
    },
  },
  {
    id: 'indie',
    name: 'Indie Film',
    categories: ['cine', 'vintage'],
    photo: 'dog',
    patch: {
      light: { contrast: -10, highlights: -15 },
      color: { temperature: 8, saturation: -20 },
      curves: { rgb: [0.14, 0.32, 0.52, 0.74, 0.93] },
      detail: { grain: 20, vignette: 15 },
    },
  },
  {
    id: 'scifi',
    name: 'Sci-Fi',
    categories: ['cine', 'night'],
    photo: 'cinematic',
    patch: {
      light: { contrast: 28, highlights: -10, blacks: -15 },
      color: { temperature: -22, saturation: -10 },
      hsl: { blue: { sat: 20 }, aqua: { sat: 15 }, orange: { sat: -20 } },
      detail: { clarity: 25, vignette: 25 },
    },
  },

  /* ---------- Vintage ---------- */
  {
    id: 'kodachrome',
    name: 'Kodachrome',
    categories: ['vintage'],
    photo: 'vintage',
    patch: {
      light: { contrast: 18, highlights: -10, blacks: -5 },
      color: { temperature: 10, saturation: 10 },
      hsl: { red: { sat: 20 }, yellow: { sat: 10 }, blue: { hue: -10, sat: 10 } },
      detail: { grain: 15 },
    },
  },
  {
    id: 'fujiclassic',
    name: 'Fuji Classic',
    categories: ['vintage'],
    photo: 'lake',
    patch: {
      light: { contrast: 8, highlights: -12 },
      color: { temperature: -4, tint: -4, saturation: -10 },
      curves: { g: [0.04, 0.27, 0.51, 0.75, 0.98], b: [0.08, 0.29, 0.5, 0.72, 0.95] },
      hsl: { green: { hue: 15, sat: -10 }, red: { sat: 10 } },
      detail: { grain: 20 },
    },
  },
  {
    id: 'sepia1920',
    name: 'Sepia 1920',
    categories: ['vintage', 'bw'],
    photo: 'hat',
    patch: {
      look: 'vintage',
      light: { contrast: 15, highlights: -10 },
      curves: { rgb: [0.08, 0.27, 0.5, 0.74, 0.94] },
      detail: { grain: 35, vignette: 35 },
    },
  },
  {
    id: 'disposable',
    name: 'Disposable Cam',
    categories: ['vintage', 'night'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 6, contrast: 25, whites: 15, blacks: -10 },
      color: { temperature: 10, tint: 6, vibrance: 12 },
      detail: { grain: 30, vignette: 30, sharpness: 10 },
    },
  },
  {
    id: 'vhs',
    name: 'VHS 90s',
    categories: ['vintage'],
    photo: 'dog',
    patch: {
      light: { contrast: -10 },
      color: { tint: 10, saturation: -15 },
      curves: { rgb: [0.1, 0.3, 0.52, 0.74, 0.93], r: [0.03, 0.27, 0.52, 0.76, 1] },
      detail: { sharpness: 0, clarity: -15, grain: 40, vignette: 15 },
    },
  },
  {
    id: 'faded',
    name: 'Faded Memories',
    categories: ['vintage', 'aesthetic'],
    photo: 'vintage',
    patch: {
      light: { contrast: -25, highlights: -10 },
      color: { temperature: 6, saturation: -30 },
      curves: { rgb: [0.18, 0.35, 0.53, 0.73, 0.9] },
      detail: { grain: 15 },
    },
  },

  /* ---------- Aesthetic ---------- */
  {
    id: 'lavender',
    name: 'Lavender',
    categories: ['aesthetic'],
    photo: 'lake',
    patch: {
      light: { exposure: 6, contrast: -15 },
      color: { temperature: -10, tint: 15, saturation: -15 },
      curves: { b: [0.06, 0.3, 0.54, 0.78, 1] },
      hsl: { purple: { sat: 15 }, magenta: { lum: 10 } },
    },
  },
  {
    id: 'cream',
    name: 'Cream',
    categories: ['aesthetic'],
    photo: 'coffee',
    patch: {
      light: { exposure: 8, contrast: -20, shadows: 15 },
      color: { temperature: 15, saturation: -20 },
      curves: { rgb: [0.1, 0.31, 0.54, 0.77, 0.96] },
      detail: { clarity: -10 },
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    categories: ['aesthetic', 'landscape'],
    photo: 'plant',
    patch: {
      light: { contrast: -10, highlights: -10 },
      color: { temperature: 4, saturation: -20 },
      hsl: { green: { hue: 20, sat: -25, lum: 5 }, yellow: { sat: -15 } },
      curves: { rgb: [0.08, 0.29, 0.52, 0.75, 0.95] },
    },
  },
  {
    id: 'cloudnine',
    name: 'Cloud Nine',
    categories: ['aesthetic'],
    photo: 'coast',
    patch: {
      light: { exposure: 15, contrast: -20, whites: 10, shadows: 20 },
      color: { temperature: -8, saturation: -10 },
      curves: { rgb: [0.08, 0.32, 0.57, 0.81, 1] },
    },
  },
  {
    id: 'blush',
    name: 'Blush',
    categories: ['aesthetic', 'portrait'],
    photo: 'modelWhite',
    patch: {
      light: { exposure: 6, contrast: -12 },
      color: { tint: 18, saturation: -5 },
      curves: { r: [0.04, 0.28, 0.53, 0.78, 1] },
      hsl: { red: { lum: 8 }, magenta: { sat: 10 } },
    },
  },
  {
    id: 'cocoa',
    name: 'Cocoa',
    categories: ['aesthetic', 'food'],
    photo: 'coffee',
    patch: {
      light: { contrast: 12, highlights: -15 },
      color: { temperature: 22, saturation: -15 },
      hsl: { orange: { hue: -8, lum: -8 }, yellow: { hue: -10, sat: -10 } },
      detail: { vignette: 15 },
    },
  },

  /* ---------- Black and white ---------- */
  {
    id: 'highkey',
    name: 'High Key',
    categories: ['bw'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 20, contrast: -10, whites: 20, shadows: 25 },
      color: { saturation: -100 },
      curves: { rgb: [0.1, 0.35, 0.6, 0.83, 1] },
    },
  },
  {
    id: 'gritty',
    name: 'Gritty',
    categories: ['bw', 'cine'],
    photo: 'modelWhite',
    patch: {
      light: { contrast: 40, blacks: -25, whites: 10 },
      color: { saturation: -100 },
      detail: { clarity: 50, sharpness: 30, grain: 40, vignette: 25 },
    },
  },
  {
    id: 'selenium',
    name: 'Selenium',
    categories: ['bw'],
    photo: 'modelVanity',
    patch: {
      light: { contrast: 20 },
      color: { saturation: -100 },
      curves: { b: [0.06, 0.3, 0.54, 0.77, 1], r: [0, 0.23, 0.48, 0.74, 0.98] },
      detail: { clarity: 15 },
    },
  },

  /* ---------- Food ---------- */
  {
    id: 'tasty',
    name: 'Tasty',
    categories: ['food'],
    photo: 'coffee',
    patch: {
      light: { exposure: 5, contrast: 15, shadows: 10 },
      color: { temperature: 10, vibrance: 25 },
      hsl: { red: { sat: 12 }, orange: { sat: 12 }, green: { sat: 10 } },
      detail: { clarity: 20, sharpness: 25 },
    },
  },
  {
    id: 'brunch',
    name: 'Brunch',
    categories: ['food', 'aesthetic'],
    photo: 'coffee',
    patch: {
      light: { exposure: 15, contrast: -10, shadows: 20, whites: 10 },
      color: { temperature: 10, vibrance: 10 },
      curves: { rgb: [0.05, 0.3, 0.55, 0.79, 1] },
      detail: { clarity: 5 },
    },
  },
  {
    id: 'dessert',
    name: 'Dessert',
    categories: ['food'],
    photo: 'coffee',
    patch: {
      light: { exposure: 10, contrast: -12 },
      color: { tint: 10, vibrance: 15 },
      hsl: { magenta: { sat: 12, lum: 8 }, red: { lum: 6 } },
      detail: { clarity: -8 },
    },
  },

  /* ---------- Landscape ---------- */
  {
    id: 'andes',
    name: 'Andes',
    categories: ['landscape', 'latino'],
    photo: 'patagonia',
    patch: {
      light: { contrast: 20, highlights: -25, shadows: 15 },
      color: { vibrance: 20 },
      hsl: { blue: { sat: 20, lum: -10 }, green: { sat: 10 } },
      detail: { clarity: 25, vignette: 10 },
    },
  },
  {
    id: 'deepforest',
    name: 'Deep Forest',
    categories: ['landscape'],
    photo: 'plant',
    patch: {
      light: { exposure: -5, contrast: 15, highlights: -15, shadows: -5 },
      color: { temperature: -5, saturation: -5 },
      hsl: { green: { hue: 15, sat: 10, lum: -15 }, yellow: { hue: 15 } },
      detail: { clarity: 15, vignette: 25 },
    },
  },
  {
    id: 'goldenfield',
    name: 'Golden Field',
    categories: ['landscape', 'aesthetic'],
    photo: 'lake',
    patch: {
      light: { exposure: 5, highlights: -15, shadows: 10 },
      color: { temperature: 25, vibrance: 15 },
      hsl: { yellow: { sat: 15 }, green: { hue: -15, sat: -10 } },
      detail: { vignette: 10 },
    },
  },

  /* ---------- Night ---------- */
  {
    id: 'citylights',
    name: 'City Lights',
    categories: ['night', 'cine'],
    photo: 'havana',
    patch: {
      light: { contrast: 20, highlights: -20, shadows: 10, blacks: -15 },
      color: { temperature: -10, vibrance: 15 },
      curves: { b: [0.06, 0.29, 0.5, 0.71, 0.95] },
      hsl: { orange: { sat: 15, lum: 8 }, yellow: { sat: 10 }, blue: { sat: 15 } },
      detail: { clarity: 15, noise: 20 },
    },
  },
  {
    id: 'neonnight',
    name: 'Neon Night',
    categories: ['night'],
    photo: 'modelVanity',
    patch: {
      light: { contrast: 18, blacks: -15 },
      color: { tint: 12, vibrance: 30 },
      hsl: { magenta: { sat: 25 }, aqua: { sat: 25 }, blue: { sat: 15 } },
      detail: { noise: 20, vignette: 20 },
    },
  },
  {
    id: 'candlelight',
    name: 'Candlelight',
    categories: ['night', 'portrait'],
    photo: 'modelVanity',
    patch: {
      light: { exposure: 5, contrast: -5, highlights: -15, shadows: 15 },
      color: { temperature: 35, tint: 5, saturation: -5 },
      hsl: { orange: { lum: 8 } },
      detail: { noise: 25, clarity: -10, vignette: 25 },
    },
  },
];
