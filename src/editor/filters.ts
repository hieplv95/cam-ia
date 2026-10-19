import type { Adjust } from './types';
import { t } from '../i18n';
import { isMessageKey } from '../i18n/core';

/** 4x5 row-major color matrix; the offset column is normalized to 0..1 (Skia convention). */
export type Matrix = number[];

const identity: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** Returns a·b, i.e. applies b first, then a. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  const out: number[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      out.push(v);
    }
  }
  return out;
}

const chain = (...ms: Matrix[]) => ms.reduce((acc, m) => multiply(m, acc), identity);

export function saturate(s: number): Matrix {
  const lr = 0.2126 * (1 - s);
  const lg = 0.7152 * (1 - s);
  const lb = 0.0722 * (1 - s);
  return [lr + s, lg, lb, 0, 0, lr, lg + s, lb, 0, 0, lr, lg, lb + s, 0, 0, 0, 0, 0, 1, 0];
}

export function contrast(c: number): Matrix {
  const t = (1 - c) / 2;
  return [c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0];
}

export function brightness(b: number): Matrix {
  return [1, 0, 0, 0, b, 0, 1, 0, 0, b, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
}

/** Per-channel gain and offset. */
function tint(r: number, g: number, b: number, or = 0, og = 0, ob = 0): Matrix {
  return [r, 0, 0, 0, or, 0, g, 0, 0, og, 0, 0, b, 0, ob, 0, 0, 0, 1, 0];
}

const sepia: Matrix = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0,
];

export const filters = [
  { id: 'none', name: 'Original', emoji: '📷', matrix: identity },
  { id: 'cinematic', name: 'Cinematic', emoji: '🎬', matrix: chain(saturate(0.85), contrast(1.2), tint(1.06, 1.0, 0.94, -0.02, 0.01, 0.04)) },
  { id: 'softglow', name: 'Soft Glow', emoji: '✨', matrix: chain(contrast(0.85), brightness(0.06), tint(1.04, 1.0, 0.97, 0.03, 0.02, 0.02), saturate(1.05)) },
  { id: 'candy', name: 'Candy', emoji: '🍬', matrix: chain(saturate(1.15), tint(1.05, 0.95, 1, 0.06, 0, 0.05)) },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈', matrix: chain(saturate(1.7), contrast(1.08)) },
  { id: 'sunset', name: 'Sunset', emoji: '🌅', matrix: chain(tint(1.1, 0.98, 0.82, 0.05, 0.02, 0), saturate(1.2)) },
  { id: 'ocean', name: 'Ocean', emoji: '🐬', matrix: chain(tint(0.88, 1.0, 1.12, 0, 0.02, 0.06), saturate(1.1)) },
  { id: 'princess', name: 'Princess', emoji: '👸', matrix: chain(contrast(0.85), tint(1, 0.94, 1, 0.1, 0.05, 0.1), saturate(0.9)) },
  { id: 'mint', name: 'Mint', emoji: '🍃', matrix: chain(tint(0.92, 1.05, 1, 0, 0.05, 0.03), contrast(0.95)) },
  { id: 'dreamy', name: 'Dreamy', emoji: '🦄', matrix: chain(contrast(0.8), tint(1, 0.92, 1.08, 0.08, 0.04, 0.1)) },
  { id: 'vintage', name: 'Vintage', emoji: '📜', matrix: chain(sepia, contrast(0.95)) },
  { id: 'bw', name: 'Black & White', emoji: '🐼', matrix: chain(saturate(0), contrast(1.15)) },
  // Contrast looks: from punchy to matte.
  { id: 'punch', name: 'Punch', emoji: '💥', matrix: chain(contrast(1.35), saturate(1.15)) },
  { id: 'crisp', name: 'Crisp', emoji: '🔷', matrix: chain(contrast(1.2), brightness(-0.02)) },
  { id: 'hdr', name: 'HDR', emoji: '🏞️', matrix: chain(contrast(1.25), saturate(1.3)) },
  { id: 'drama', name: 'Drama', emoji: '🎭', matrix: chain(contrast(1.45), saturate(0.75)) },
  { id: 'deepblack', name: 'Deep Black', emoji: '🖤', matrix: chain(contrast(1.3), brightness(-0.05), saturate(0.95)) },
  { id: 'matte', name: 'Matte', emoji: '🌫️', matrix: chain(contrast(0.82), brightness(0.05)) },
  { id: 'fade', name: 'Fade', emoji: '🍂', matrix: chain(contrast(0.75), saturate(0.8), brightness(0.06)) },
  { id: 'airy', name: 'Airy', emoji: '☁️', matrix: chain(brightness(0.1), contrast(0.88), tint(0.98, 1, 1.03, 0, 0.01, 0.02)) },
  { id: 'moody', name: 'Moody', emoji: '🌧️', matrix: chain(brightness(-0.06), contrast(1.15), saturate(0.75), tint(0.96, 1, 1.05, 0, 0, 0.02)) },
  // Color looks.
  { id: 'golden', name: 'Golden', emoji: '🌟', matrix: chain(tint(1.12, 1.02, 0.85, 0.03, 0.01, 0), contrast(1.05)) },
  { id: 'peach', name: 'Peach', emoji: '🍑', matrix: chain(tint(1.08, 0.98, 0.94, 0.04, 0.02, 0.02), contrast(0.95)) },
  { id: 'rose', name: 'Rosé', emoji: '🌹', matrix: chain(tint(1.06, 0.94, 1, 0.06, 0, 0.04)) },
  { id: 'lavender', name: 'Lavender', emoji: '💜', matrix: chain(tint(1, 0.95, 1.1, 0.04, 0.02, 0.08), saturate(0.9)) },
  { id: 'teal', name: 'Teal', emoji: '🦚', matrix: chain(tint(0.9, 1.02, 1.08, 0, 0.02, 0.04), contrast(1.15)) },
  { id: 'tealorange', name: 'Teal & Orange', emoji: '🎞️', matrix: chain(tint(1.12, 1, 0.88, -0.04, 0, 0.06), contrast(1.15)) },
  { id: 'forest', name: 'Forest', emoji: '🌲', matrix: chain(tint(0.92, 1.06, 0.94, 0, 0.02, 0), saturate(1.1)) },
  { id: 'desert', name: 'Desert', emoji: '🏜️', matrix: chain(tint(1.1, 1, 0.86, 0.04, 0.02, 0), saturate(0.85)) },
  { id: 'arctic', name: 'Arctic', emoji: '🧊', matrix: chain(tint(0.92, 1, 1.12, 0.02, 0.04, 0.08), brightness(0.04), saturate(0.85)) },
  { id: 'neon', name: 'Neon', emoji: '🪩', matrix: chain(saturate(1.5), contrast(1.15), tint(1.05, 0.95, 1.1)) },
  // Old film and black-and-white.
  { id: 'retro', name: 'Retro', emoji: '📻', matrix: chain(tint(1.08, 1, 0.85, 0.06, 0.04, 0), saturate(0.75), contrast(0.9)) },
  { id: 'polaroid', name: 'Polaroid', emoji: '🖼️', matrix: chain(tint(1.05, 1, 0.92, 0.05, 0.04, 0.02), contrast(0.9), saturate(0.9)) },
  { id: 'noir', name: 'Noir', emoji: '🕶️', matrix: chain(saturate(0), contrast(1.45), brightness(-0.04)) },
  { id: 'silver', name: 'Silver', emoji: '🥈', matrix: chain(saturate(0), contrast(0.9), brightness(0.05)) },
  { id: 'sepiasoft', name: 'Soft Sepia', emoji: '☕', matrix: chain(sepia, contrast(0.85), brightness(0.04)) },
] as const;

export type FilterId = (typeof filters)[number]['id'];

export function buildMatrix(filter: FilterId, adjust: Adjust): Matrix {
  const base = filters.find((f) => f.id === filter)?.matrix ?? identity;
  return chain(
    base as Matrix,
    saturate(adjust.saturation),
    contrast(adjust.contrast),
    brightness(adjust.brightness),
  );
}

/** A color look's name in the app's language (Cinematic, Soft Glow and Vintage keep their English names). */
export const filterName = (id: FilterId) => {
  const key = `filter.${id}`;
  return isMessageKey(key) ? t(key) : (filters.find((f) => f.id === id)?.name ?? id);
};
