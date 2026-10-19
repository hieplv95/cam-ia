import { Fill, ImageShader, Shader, Skia, type SkImage, type SkRuntimeEffect } from '@shopify/react-native-skia';

import { renderImage } from './imageOps';
import type { EraseMark } from './types';

/**
 * Free face and body reshaping on the device (no AI), from the marks the user paints on the photo:
 * - bigger eyes, fuller lips, slimmer nose: a tap on the feature magnifies (or narrows) the area under it;
 * - slimmer (V-line, jaw, shoulders, waist): a stroke from the outside in pushes the edge the way it was drawn;
 * - longer legs: the band covered by the marks is stretched vertically (the picture gets taller);
 * - taller: the lower part of the picture is stretched, no marks needed.
 * Each is a Skia shader pass over the flattened picture (image-pixel coordinates); samples never leave the picture
 * (clamped to its edge), so pushing near a border repeats the edge instead of showing black.
 */

const SKSL = {
  // An elliptic lens: a positive amount magnifies along that axis, a negative one narrows.
  lens: `
uniform shader image;
uniform float2 size;
uniform float2 center;
uniform float2 radius;
uniform float2 amount;
half4 main(float2 p) {
  float2 d = p - center;
  float t = length(d / radius);
  if (t < 1.0) {
    float k = (1.0 - t * t);
    p = center + d * (1.0 - amount * k * k);
  }
  return image.eval(clamp(p, float2(0.5), size - 0.5));
}`,
  push: `
uniform shader image;
uniform float2 size;
uniform float2 target;
uniform float2 delta;
uniform float radius;
half4 main(float2 p) {
  float t = length(p - target) / radius;
  if (t < 1.0) {
    float k = (1.0 - t * t);
    // The picture's own border doesn't move, so a push near the edge never drags the outside in.
    float edge = min(min(p.x, size.x - p.x), min(p.y, size.y - p.y));
    float hold = clamp(edge / max(length(delta), 1.0), 0.0, 1.0);
    p = p - delta * k * k * hold;
  }
  return image.eval(clamp(p, float2(0.5), size - 0.5));
}`,
  stretch: `
uniform shader image;
uniform float2 size;
uniform float y0;
uniform float y1;
uniform float k;
half4 main(float2 p) {
  float bottom = y0 + (y1 - y0) * k;
  float y = p.y < y0 ? p.y : (p.y < bottom ? y0 + (p.y - y0) / k : p.y - (y1 - y0) * (k - 1.0));
  return image.eval(clamp(float2(p.x, y), float2(0.5), size - 0.5));
}`,
  // Nose contour, like makeup: a soft light down the bridge (from top to tip) and a soft shade on each side of it.
  contour: `
uniform shader image;
uniform float2 size;
uniform float2 top;
uniform float2 tip;
uniform float light;
uniform float shade;
uniform float side;
uniform float lightWidth;
uniform float shadeWidth;
half4 main(float2 p) {
  half4 c = image.eval(p);
  float u = clamp((p.y - top.y) / (tip.y - top.y), 0.0, 1.0);
  float along = smoothstep(0.0, 0.25, u) * (1.0 - smoothstep(0.8, 1.0, u));
  if (p.y < top.y || p.y > tip.y) along = 0.0;
  float d = abs(p.x - mix(top.x, tip.x, u));
  float hi = exp(-(d * d) / (lightWidth * lightWidth)) * light * along;
  float sh = exp(-((d - side) * (d - side)) / (shadeWidth * shadeWidth)) * shade * along;
  half3 rgb = c.rgb * (1.0 - sh * half3(1.0, 1.08, 1.15)) + hi;
  return half4(clamp(rgb, 0.0, 1.0), c.a);
}`,
};

// Compiled on first use: on the web Skia finishes loading after the modules are evaluated.
const compiled: Partial<Record<keyof typeof SKSL, SkRuntimeEffect>> = {};
const effect = (name: keyof typeof SKSL) => {
  const e = (compiled[name] ??= Skia.RuntimeEffect.Make(SKSL[name]) ?? undefined);
  if (!e) throw new Error(`reshape shader ${name}`);
  return e;
};

const CUBIC = { B: 1 / 3, C: 1 / 3 };

function pass(img: SkImage, name: keyof typeof SKSL, uniforms: Record<string, number | number[]>, height = img.height()) {
  const w = img.width();
  return renderImage(
    <Fill>
      <Shader source={effect(name)} uniforms={{ ...uniforms, size: [w, img.height()] }}>
        {/* Bicubic (Mitchell) sampling: the reshaped area stays sharp instead of softening with every Apply. */}
        <ImageShader image={img} fit="none" x={0} y={0} width={w} height={img.height()} tx="clamp" ty="clamp" sampling={CUBIC} />
      </Shader>
    </Fill>,
    w,
    height,
  );
}

const xs = (m: EraseMark) => m.points.filter((_, i) => i % 2 === 0);
const ys = (m: EraseMark) => m.points.filter((_, i) => i % 2 === 1);
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** One lens per mark, centred on it and sized by how far it spreads; `shape` gives [rx/r, ry/r, ax, ay]. */
async function lenses(img: SkImage, marks: EraseMark[], shape: (r: number) => [number, number, number, number]) {
  let out = img;
  for (const m of marks) {
    const spread = Math.max(Math.max(...xs(m)) - Math.min(...xs(m)), Math.max(...ys(m)) - Math.min(...ys(m)));
    const r = Math.max(m.width * 1.1, spread * 0.75 + m.width * 0.6);
    const [kx, ky, ax, ay] = shape(r);
    out = await pass(out, 'lens', { center: [mean(xs(m)), mean(ys(m))], radius: [r * kx, r * ky], amount: [ax, ay] });
  }
  return out;
}

/** Bigger eyes: each mark is one eye (its centre and size). `amount` 0..1. */
export function biggerEyes(img: SkImage, marks: EraseMark[], amount: number) {
  const a = 0.12 + amount * 0.33;
  return lenses(img, marks, () => [1, 1, a, a]);
}

/** Fuller lips: a tap on the mouth makes the lips a little taller (and barely wider). `amount` 0..1. */
export function fullerLips(img: SkImage, marks: EraseMark[], amount: number) {
  return lenses(img, marks, () => [1.25, 0.85, 0.04 + amount * 0.1, 0.1 + amount * 0.26]);
}

/** Slimmer nose: a tap on the nose narrows it sideways (taller than wide). `amount` 0..1. */
export function slimmerNose(img: SkImage, marks: EraseMark[], amount: number) {
  return lenses(img, marks, () => [0.9, 1.5, -(0.1 + amount * 0.3), 0]);
}

export type NoseLiftStyle = 'contour' | 'lift';

/**
 * Nose lift, from a tap on the tip of the nose with a dot as wide as the nose (wing to wing): R is half that width.
 * Tuned on sample photos the user picked:
 * - 'contour' ("Tạo khối"): almost no reshaping, a light down the bridge and a soft shade beside it, wings a bit
 *   narrower, like contour makeup;
 * - 'lift' ("Nâng rõ"): wings and bridge narrower, the tip lifted and the nose a little shorter, with a lighter contour.
 * `amount` 0..1; 0.5 (the default strength) is the sample look.
 */
export async function liftNose(img: SkImage, marks: EraseMark[], amount: number, style: NoseLiftStyle) {
  const f = amount * 2;
  let out = img;
  for (const m of marks) {
    const R = m.width / 2;
    const cx = mean(xs(m));
    const cy = mean(ys(m));
    const wings = style === 'lift' ? -0.17 : -0.07;
    out = await pass(out, 'lens', { center: [cx, cy + 0.086 * R], radius: [1.2 * R, 0.62 * R], amount: [wings * f, 0] });
    if (style === 'lift') {
      out = await pass(out, 'lens', { center: [cx - 0.05 * R, cy - 0.86 * R], radius: [0.45 * R, 1.14 * R], amount: [-0.16 * f, 0] });
      out = await pass(out, 'push', { target: [cx, cy - 0.14 * R * f], delta: [0, -0.14 * R * f], radius: 0.76 * R });
      // Lower nose a little shorter: what sat 0.4 R under the tip moves up (push targets are where things land).
      out = await pass(out, 'push', { target: [cx, cy + 0.396 * R - 0.086 * R * f], delta: [0, -0.086 * R * f], radius: 0.86 * R });
    }
    out = await pass(out, 'contour', {
      top: [cx - 0.07 * R, cy - 1.72 * R],
      tip: [cx, cy - 0.07 * R],
      light: (style === 'lift' ? 0.045 : 0.06) * f,
      shade: (style === 'lift' ? 0.03 : 0.045) * f,
      side: 0.28 * R,
      lightWidth: 0.11 * R,
      shadeWidth: 0.18 * R,
    });
  }
  return out;
}

/** Slimmer: each mark is a push from its first point to its last (draw from the outside in). `amount` 0..1. */
export async function slimmer(img: SkImage, marks: EraseMark[], amount: number) {
  let out = img;
  for (const m of marks) {
    const n = m.points.length;
    if (n < 4) continue;
    const fx = m.points[0];
    const fy = m.points[1];
    // A tap (no real movement) has no direction to push.
    if (Math.hypot(m.points[n - 2] - fx, m.points[n - 1] - fy) <= m.width * 0.25) continue;
    const dx = (m.points[n - 2] - fx) * (0.35 + amount * 0.65);
    const dy = (m.points[n - 1] - fy) * (0.35 + amount * 0.65);
    const radius = Math.max(m.width * 1.6, Math.hypot(dx, dy) * 1.5);
    out = await pass(out, 'push', { target: [fx + dx, fy + dy], delta: [dx, dy], radius });
  }
  return out;
}

/** Longer legs: stretches the band the marks cover (top to bottom) by up to 30 %. `amount` 0..1. */
export function longerLegs(img: SkImage, marks: EraseMark[], amount: number) {
  const all = marks.flatMap(ys);
  const pad = Math.max(...marks.map((m) => m.width)) / 2;
  const y0 = Math.max(0, Math.min(...all) - pad);
  const y1 = Math.min(img.height(), Math.max(...all) + pad);
  const k = 1 + 0.05 + amount * 0.25;
  return pass(img, 'stretch', { y0, y1, k }, Math.round(img.height() + (y1 - y0) * (k - 1)));
}

/** Taller: stretches the lower 55 % of the picture (legs and body) by up to 12 %; the picture gets taller. `amount` 0..1. */
export function taller(img: SkImage, amount: number) {
  const h = img.height();
  const y0 = Math.round(h * 0.45);
  const k = 1.03 + amount * 0.09;
  return pass(img, 'stretch', { y0, y1: h, k }, Math.round(h + (h - y0) * (k - 1)));
}
