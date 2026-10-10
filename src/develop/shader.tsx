import { ColorMatrix, ImageShader, Rect, rect, Shader, Skia, type SkImage, type SkRuntimeEffect } from '@shopify/react-native-skia';

import { buildMatrix, multiply } from '../editor/filters';
import { defaultAdjust } from '../editor/types';
import { hslRanges, type Develop } from './types';

/**
 * One-pass develop shader. Order: detail (needs neighbour samples) → exposure → white balance →
 * tone (highlights/shadows/whites/blacks) → contrast → curves → saturation/vibrance → HSL → vignette → grain.
 * With every setting at 0 it is an identity transform.
 */
const SKSL = `
uniform shader image;
uniform float2 size;
uniform float exposure; uniform float contrast; uniform float highlights; uniform float shadows;
uniform float whites; uniform float blacks;
uniform float temperature; uniform float tint; uniform float saturation; uniform float vibrance;
uniform float curveRgb[5]; uniform float curveR[5]; uniform float curveG[5]; uniform float curveB[5];
uniform float hslCenter[8]; uniform float hslHue[8]; uniform float hslSat[8]; uniform float hslLum[8];
uniform float sharpness; uniform float clarity; uniform float noise; uniform float vignette; uniform float grain;
uniform float bSmooth; uniform float bBrighten; uniform float bRosy; uniform float bEven; uniform float bGlow; uniform float bDetail;

float luma(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

float curve5(float x, float p0, float p1, float p2, float p3, float p4) {
  float seg = clamp(x * 4.0, 0.0, 3.9999);
  float t = fract(seg);
  float a; float b; float c; float d;
  if (seg < 1.0) { a = 2.0 * p0 - p1; b = p0; c = p1; d = p2; }
  else if (seg < 2.0) { a = p0; b = p1; c = p2; d = p3; }
  else if (seg < 3.0) { a = p1; b = p2; c = p3; d = p4; }
  else { a = p2; b = p3; c = p4; d = 2.0 * p4 - p3; }
  float v = 0.5 * (2.0 * b + (-a + c) * t + (2.0 * a - 5.0 * b + 4.0 * c - d) * t * t + (-a + 3.0 * b - 3.0 * c + d) * t * t * t);
  return clamp(v, 0.0, 1.0);
}

float3 rgb2hsl(float3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float h = 0.0; float s = 0.0; float d = mx - mn;
  if (d > 0.00001) {
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) { h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0); }
    else if (mx == c.g) { h = (c.b - c.r) / d + 2.0; }
    else { h = (c.r - c.g) / d + 4.0; }
    h = h / 6.0;
  }
  return float3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) { t += 1.0; }
  if (t > 1.0) { t -= 1.0; }
  if (t < 1.0 / 6.0) { return p + (q - p) * 6.0 * t; }
  if (t < 0.5) { return q; }
  if (t < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
  return p;
}

float3 hsl2rgb(float3 hsl) {
  if (hsl.y <= 0.0) { return float3(hsl.z); }
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return float3(hue2rgb(p, q, hsl.x + 1.0 / 3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0 / 3.0));
}

// Soft skin likelihood (0..1) from the classic YCbCr skin box, faded out in deep shadows and blown highlights.
float skinMask(float3 c) {
  float y = luma(c);
  float cb = 0.5 - 0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
  float cr = 0.5 + 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;
  float m = smoothstep(0.28, 0.32, cb) * (1.0 - smoothstep(0.49, 0.53, cb))
          * smoothstep(0.51, 0.55, cr) * (1.0 - smoothstep(0.66, 0.70, cr));
  return m * smoothstep(0.08, 0.2, y) * (1.0 - smoothstep(0.95, 1.0, y));
}

half4 main(float2 xy) {
  // Offsets are relative to the picture size so the preview matches the full-size export.
  float u = max(size.x, size.y) / 1200.0;
  float3 c = image.eval(xy).rgb;

  // ---- Free beauty (skin is found by color, no AI) ----
  float3 c0 = c;
  bool anyBeauty = bSmooth > 0.0 || bBrighten > 0.0 || bRosy > 0.0 || bEven > 0.0 || bDetail > 0.0;
  float skin = anyBeauty ? skinMask(c0) : 0.0;
  if (bSmooth > 0.0 || bEven > 0.0) {
    // Edge-preserving blur: neighbours that differ a lot (eyes, brows, lips, hair) barely count.
    float3 acc = c0;
    float wsum = 1.0;
    for (int ring = 1; ring <= 2; ring++) {
      float r = 2.5 * u * float(ring) * (1.0 + bSmooth);
      for (int k = 0; k < 8; k++) {
        float a = float(k) * 0.785398 + float(ring) * 0.39;
        float3 smp = image.eval(xy + float2(cos(a), sin(a)) * r).rgb;
        float3 d = smp - c0;
        float w = exp(-dot(d, d) * 90.0);
        acc += smp * w;
        wsum += w;
      }
    }
    float3 soft = acc / wsum;
    c = mix(c, soft, bSmooth * skin * 0.9);
    // Even tone: keep each pixel's brightness but take the smoothed color, so blotches fade.
    c = mix(c, luma(c) + (soft - luma(soft)), bEven * skin * 0.7);
  }
  if (bDetail > 0.0) {
    float o = 1.2 * u;
    float3 n4 = (image.eval(xy + float2(o, 0.0)).rgb + image.eval(xy - float2(o, 0.0)).rgb +
                 image.eval(xy + float2(0.0, o)).rgb + image.eval(xy - float2(0.0, o)).rgb) * 0.25;
    c = c + (c0 - n4) * bDetail * 1.8 * (1.0 - skin);
  }
  if (bGlow > 0.0) {
    float r = 10.0 * u;
    float3 bloom = float3(0.0);
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398;
      bloom += max(image.eval(xy + float2(cos(a), sin(a)) * r).rgb - 0.55, 0.0);
    }
    c = c + bloom / 8.0 * bGlow * 1.2;
    c = mix(c, c * 0.92 + 0.08, bGlow * 0.3);
  }
  c = c + bBrighten * 0.14 * skin * (1.0 - luma(c));
  c = c + float3(0.05, -0.006, 0.012) * bRosy * skin;

  if (sharpness > 0.0 || noise > 0.0) {
    float o = 1.5 * u;
    float3 n4 = (image.eval(xy + float2(o, 0.0)).rgb + image.eval(xy - float2(o, 0.0)).rgb +
                 image.eval(xy + float2(0.0, o)).rgb + image.eval(xy - float2(0.0, o)).rgb) * 0.25;
    c = mix(c, (c + n4 * 4.0) / 5.0, noise * 0.85);
    c = c + (c - n4) * sharpness * 1.6;
  }
  if (clarity != 0.0) {
    float r = 14.0 * u;
    float3 wide = (image.eval(xy + float2(r, 0.0)).rgb + image.eval(xy - float2(r, 0.0)).rgb +
                   image.eval(xy + float2(0.0, r)).rgb + image.eval(xy - float2(0.0, r)).rgb +
                   image.eval(xy + float2(r, r) * 0.7).rgb + image.eval(xy - float2(r, r) * 0.7).rgb +
                   image.eval(xy + float2(r, -r) * 0.7).rgb + image.eval(xy - float2(r, -r) * 0.7).rgb) * 0.125;
    float L0 = luma(c);
    c = c + (L0 - luma(wide)) * clarity * 0.9 * (1.0 - abs(2.0 * L0 - 1.0));
  }

  c = c * exp2(exposure * 1.5);
  c = c * float3(1.0 + temperature * 0.15 + tint * 0.04, 1.0 - tint * 0.12, 1.0 - temperature * 0.15 + tint * 0.04);

  float L = luma(c);
  float L2 = L
    + shadows * 0.3 * (1.0 - smoothstep(0.0, 0.55, L))
    + highlights * 0.3 * smoothstep(0.45, 1.0, L)
    + whites * 0.15 * smoothstep(0.7, 1.0, L)
    + blacks * 0.15 * (1.0 - smoothstep(0.0, 0.3, L));
  float3 scaled = c * (L2 / max(L, 0.0001));
  c = mix(c + (L2 - L), scaled, smoothstep(0.0, 0.06, L));
  c = (c - 0.5) * (1.0 + contrast * 0.6) + 0.5;

  c = clamp(c, 0.0, 1.0);
  c = float3(curve5(c.r, curveRgb[0], curveRgb[1], curveRgb[2], curveRgb[3], curveRgb[4]),
             curve5(c.g, curveRgb[0], curveRgb[1], curveRgb[2], curveRgb[3], curveRgb[4]),
             curve5(c.b, curveRgb[0], curveRgb[1], curveRgb[2], curveRgb[3], curveRgb[4]));
  c = float3(curve5(c.r, curveR[0], curveR[1], curveR[2], curveR[3], curveR[4]),
             curve5(c.g, curveG[0], curveG[1], curveG[2], curveG[3], curveG[4]),
             curve5(c.b, curveB[0], curveB[1], curveB[2], curveB[3], curveB[4]));

  float Ls = luma(c);
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(float3(Ls), c, 1.0 + saturation + vibrance * (1.0 - sat));

  float3 hsl = rgb2hsl(clamp(c, 0.0, 1.0));
  float dh = 0.0; float ds = 0.0; float dl = 0.0;
  float colorful = smoothstep(0.0, 0.15, hsl.y);
  for (int i = 0; i < 8; i++) {
    float d = abs(hsl.x - hslCenter[i]);
    d = min(d, 1.0 - d);
    float w = clamp(1.0 - d / 0.09, 0.0, 1.0);
    w = w * w * (3.0 - 2.0 * w) * colorful;
    dh += hslHue[i] * w; ds += hslSat[i] * w; dl += hslLum[i] * w;
  }
  if (dh != 0.0 || ds != 0.0 || dl != 0.0) {
    hsl.x = fract(hsl.x + dh * 0.083 + 1.0);
    hsl.y = clamp(hsl.y * (1.0 + ds), 0.0, 1.0);
    hsl.z = clamp(hsl.z + dl * 0.2, 0.0, 1.0);
    c = hsl2rgb(hsl);
  }

  float2 uv = xy / size;
  float vd = smoothstep(0.35, 1.0, distance(uv, float2(0.5)) * 1.414);
  c = vignette > 0.0 ? c * (1.0 - vignette * vd * 0.8) : mix(c, float3(1.0), -vignette * vd * 0.6);

  float g = fract(sin(dot(floor(xy / max(u, 0.5)), float2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c = c + g * grain * 0.14;

  return half4(clamp(c, 0.0, 1.0), 1.0);
}
`;

let effect: SkRuntimeEffect | null | undefined;

/** Compiled lazily: Skia (CanvasKit on web) is not available when modules are first evaluated on the server. */
export function developEffect() {
  if (effect === undefined) {
    effect = Skia.RuntimeEffect.Make(SKSL);
    if (!effect) console.error('Develop shader failed to compile');
  }
  return effect;
}

const pct = (v: number) => v / 100;

export function developUniforms(d: Develop, width: number, height: number) {
  return {
    size: [width, height],
    exposure: pct(d.light.exposure),
    contrast: pct(d.light.contrast),
    highlights: pct(d.light.highlights),
    shadows: pct(d.light.shadows),
    whites: pct(d.light.whites),
    blacks: pct(d.light.blacks),
    temperature: pct(d.color.temperature),
    tint: pct(d.color.tint),
    saturation: pct(d.color.saturation),
    vibrance: pct(d.color.vibrance),
    curveRgb: d.curves.rgb,
    curveR: d.curves.r,
    curveG: d.curves.g,
    curveB: d.curves.b,
    hslCenter: hslRanges.map((r) => r.center / 360),
    hslHue: hslRanges.map((r) => pct(d.hsl[r.id].hue)),
    hslSat: hslRanges.map((r) => pct(d.hsl[r.id].sat)),
    hslLum: hslRanges.map((r) => pct(d.hsl[r.id].lum)),
    sharpness: pct(d.detail.sharpness),
    clarity: pct(d.detail.clarity),
    noise: pct(d.detail.noise),
    vignette: pct(d.detail.vignette),
    grain: pct(d.detail.grain),
    bSmooth: pct(d.beauty.smooth),
    bBrighten: pct(d.beauty.brighten),
    bRosy: pct(d.beauty.rosy),
    bEven: pct(d.beauty.even),
    bGlow: pct(d.beauty.glow),
    bDetail: pct(d.beauty.detail),
  };
}

/** The developed picture filling a width×height area; used for the live preview and for export. */
export function DevelopedImage({
  image,
  develop,
  width,
  height,
  fit = 'fill',
  tint,
}: {
  image: SkImage;
  develop: Develop;
  width: number;
  height: number;
  /** "cover" crops to fill thumbnails of a different aspect ratio. */
  fit?: 'fill' | 'cover';
  /** Extra color matrix applied after the look (used by the retouch brushes). */
  tint?: number[];
}) {
  const source = developEffect();
  if (!source) return null;
  const look = develop.look !== 'none' ? buildMatrix(develop.look, defaultAdjust) : null;
  const matrix = look && tint ? multiply(tint, look) : (tint ?? look);
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <Shader source={source} uniforms={developUniforms(develop, width, height)}>
        <ImageShader image={image} fit={fit} rect={rect(0, 0, width, height)} />
      </Shader>
      {matrix && <ColorMatrix matrix={matrix} />}
    </Rect>
  );
}
