import type { FilterId } from '../editor/filters';
import { defaultDevelop, hslRanges, type CurveChannel, type Develop, type HslRange, type SplitTone } from './types';

/** A color recipe: only the settings that differ from neutral (presets, CamIA Filters). */
export type DevelopPatch = {
  light?: Partial<Develop['light']>;
  color?: Partial<Develop['color']>;
  curves?: Partial<Record<CurveChannel, number[]>>;
  hsl?: Partial<Record<HslRange, Partial<Develop['hsl'][HslRange]>>>;
  detail?: Partial<Develop['detail']>;
  beauty?: Partial<Develop['beauty']>;
  split?: Partial<SplitTone>;
  /** Color look layered on top (e.g. sepia); applied whenever the preset is on. */
  look?: FilterId;
};

const linear = [0, 0.25, 0.5, 0.75, 1];

/** The recipe as full develop settings, blended from neutral by t (0–1). */
export function developFromPatch(patch: DevelopPatch, t = 1): Develop {
  const d = defaultDevelop();
  for (const [k, v] of Object.entries(patch.light ?? {})) d.light[k as keyof Develop['light']] = Math.round(v * t);
  for (const [k, v] of Object.entries(patch.color ?? {})) d.color[k as keyof Develop['color']] = Math.round(v * t);
  for (const [k, v] of Object.entries(patch.detail ?? {})) d.detail[k as keyof Develop['detail']] = Math.round(v * t);
  for (const [k, v] of Object.entries(patch.beauty ?? {})) d.beauty[k as keyof Develop['beauty']] = Math.round(v * t);
  for (const [k, pts] of Object.entries(patch.curves ?? {})) {
    d.curves[k as CurveChannel] = pts.map((y, i) => linear[i] + (y - linear[i]) * t);
  }
  if (patch.look && t > 0) d.look = patch.look;
  for (const r of hslRanges) {
    const p = patch.hsl?.[r.id];
    if (p) d.hsl[r.id] = { hue: Math.round((p.hue ?? 0) * t), sat: Math.round((p.sat ?? 0) * t), lum: Math.round((p.lum ?? 0) * t) };
  }
  if (patch.split) {
    const s = patch.split;
    // Hues stay put; only the amounts fade with t.
    d.split = {
      shadowHue: s.shadowHue ?? 0,
      shadowSat: Math.round((s.shadowSat ?? 0) * t),
      highlightHue: s.highlightHue ?? 0,
      highlightSat: Math.round((s.highlightSat ?? 0) * t),
      balance: Math.round((s.balance ?? 0) * t),
    };
  }
  return d;
}
