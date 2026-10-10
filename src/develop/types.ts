import type { FilterId } from '../editor/filters';
import type { MessageKey } from '../i18n/core';

/** Manual "develop" settings, Lightroom-style. Slider values are integers in their slider range. */
export type Develop = {
  light: { exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number };
  color: { temperature: number; tint: number; saturation: number; vibrance: number };
  /** Tone curve heights (0..1) at x = 0, .25, .5, .75, 1 for the combined and per-channel curves. */
  curves: Record<CurveChannel, number[]>;
  hsl: Record<HslRange, { hue: number; sat: number; lum: number }>;
  detail: { sharpness: number; clarity: number; noise: number; vignette: number; grain: number };
  /** Free on-device beauty, applied to automatically detected skin (0..100). */
  beauty: { smooth: number; brighten: number; rosy: number; even: number; glow: number; detail: number };
  /** Color filter applied on top of the manual settings. */
  look: FilterId;
};

export type CurveChannel = 'rgb' | 'r' | 'g' | 'b';

export const hslRanges = [
  { id: 'red', label: 'hsl.red', color: '#F04438', center: 0 },
  { id: 'orange', label: 'hsl.orange', color: '#F79009', center: 30 },
  { id: 'yellow', label: 'hsl.yellow', color: '#FAD02C', center: 60 },
  { id: 'green', label: 'hsl.green', color: '#32C25C', center: 120 },
  { id: 'aqua', label: 'hsl.aqua', color: '#2ED3D3', center: 180 },
  { id: 'blue', label: 'hsl.blue', color: '#3B82F6', center: 220 },
  { id: 'purple', label: 'hsl.purple', color: '#8B5CF6', center: 270 },
  { id: 'magenta', label: 'hsl.magenta', color: '#E64AB0', center: 320 },
] as const;

export type HslRange = (typeof hslRanges)[number]['id'];

const linearCurve = () => [0, 0.25, 0.5, 0.75, 1];

export const defaultDevelop = (): Develop => ({
  light: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
  color: { temperature: 0, tint: 0, saturation: 0, vibrance: 0 },
  curves: { rgb: linearCurve(), r: linearCurve(), g: linearCurve(), b: linearCurve() },
  hsl: Object.fromEntries(hslRanges.map((r) => [r.id, { hue: 0, sat: 0, lum: 0 }])) as Develop['hsl'],
  detail: { sharpness: 0, clarity: 0, noise: 0, vignette: 0, grain: 0 },
  beauty: { smooth: 0, brighten: 0, rosy: 0, even: 0, glow: 0, detail: 0 },
  look: 'none',
});

export type SliderDef<K extends string> = {
  key: K;
  /** Translation key of the label. */
  label: MessageKey;
  min: number;
  max: number;
  /** Track gradient; a plain track when omitted. */
  gradient?: readonly string[];
};

const neutral = ['#D9CFC2', '#7D7064'] as const;

export const lightSliders: SliderDef<keyof Develop['light']>[] = [
  { key: 'exposure', label: 'develop.exposure', min: -100, max: 100, gradient: ['#111111', '#F5F5F5'] },
  { key: 'contrast', label: 'develop.contrast', min: -100, max: 100, gradient: neutral },
  { key: 'highlights', label: 'develop.highlights', min: -100, max: 100, gradient: neutral },
  { key: 'shadows', label: 'develop.shadows', min: -100, max: 100, gradient: neutral },
  { key: 'whites', label: 'develop.whites', min: -100, max: 100, gradient: ['#A99D90', '#FFFFFF'] },
  { key: 'blacks', label: 'develop.blacks', min: -100, max: 100, gradient: ['#000000', '#A99D90'] },
];

export const colorSliders: SliderDef<keyof Develop['color']>[] = [
  { key: 'temperature', label: 'develop.temperature', min: -100, max: 100, gradient: ['#3B82F6', '#E9E3D3', '#F5B840'] },
  { key: 'tint', label: 'develop.tint', min: -100, max: 100, gradient: ['#32C25C', '#E9E3D3', '#D946EF'] },
  { key: 'saturation', label: 'develop.saturation', min: -100, max: 100, gradient: ['#8D8A85', '#F04438', '#F79009', '#FAD02C', '#32C25C', '#3B82F6', '#8B5CF6'] },
  { key: 'vibrance', label: 'develop.vibrance', min: -100, max: 100, gradient: ['#8D8A85', '#F04438', '#F79009', '#FAD02C', '#32C25C'] },
];

export const detailSliders: SliderDef<keyof Develop['detail']>[] = [
  { key: 'sharpness', label: 'develop.sharpness', min: 0, max: 100 },
  { key: 'clarity', label: 'develop.clarity', min: -100, max: 100 },
  { key: 'noise', label: 'develop.noise', min: 0, max: 100 },
  { key: 'vignette', label: 'develop.vignette', min: -100, max: 100 },
  { key: 'grain', label: 'develop.grain', min: 0, max: 100 },
];

/** Catmull-Rom through the 5 curve points (same math as the shader), clamped to 0..1. */
export function curveAt(p: number[], x: number) {
  const seg = Math.min(Math.max(x * 4, 0), 3.9999);
  const i = Math.floor(seg);
  const t = seg - i;
  const a = i === 0 ? 2 * p[0] - p[1] : p[i - 1];
  const b = p[i];
  const c = p[i + 1];
  const d = i === 3 ? 2 * p[4] - p[3] : p[i + 2];
  const v = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  return Math.min(Math.max(v, 0), 1);
}

export const isDefault = (d: Develop) => JSON.stringify(d) === JSON.stringify(defaultDevelop());
