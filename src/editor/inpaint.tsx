import { AlphaType, BlurMask, ColorType, Fill, Group, Image, Mask, Path, Skia, type SkImage } from '@shopify/react-native-skia';

import { renderImage } from './imageOps';
import { buildStrokePath } from './Scene';
import type { EraseMark } from './types';

/**
 * "Xóa nhanh": removes what was painted over without AI, on the device (free, offline).
 * Exemplar-based fill on a small copy: the hole is filled from its edge inwards, each time copying the
 * nearby patch of the photo that best matches what is already known around that spot. The result is then
 * blended into the full picture through the painted area only (with soft edges), so the rest stays untouched.
 * Works best on simple backgrounds (grass, water, rocks, sky, walls); the AI does better on busy scenes.
 */

/** Longest side of the working copy: fast enough on phones, and the fill only covers the painted area. */
const WORK_SIDE = 420;
/** Patch radius (7×7 patches) and search window, in working-copy pixels. */
const R = 3;
const STEP = 2;

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

const pixelInfo = (width: number, height: number) => ({ width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });

function readRgba(img: SkImage, w: number, h: number) {
  const data = img.readPixels(0, 0, pixelInfo(w, h));
  if (!data || !(data instanceof Uint8Array)) throw new Error('readPixels');
  return new Uint8Array(data);
}

/** The painted marks as strokes (white, optionally widened and blurred), in the given scale. */
const marksElement = (marks: EraseMark[], scale: number, widen: number, blur = 0) => (
  <Group transform={[{ scale }]}>
    {marks.map((m, i) => (
      <Path key={i} path={buildStrokePath(m.points)} style="stroke" strokeWidth={m.width * widen} strokeCap="round" strokeJoin="round" color="white">
        {blur > 0 ? <BlurMask blur={blur} style="normal" /> : null}
      </Path>
    ))}
  </Group>
);

/** Fills the pixels where hole = 1, in place. */
async function fillHole(px: Uint8Array, w: number, h: number, hole: Uint8Array) {
  // Source patches must lie entirely outside the original hole: integral image of the hole to test that fast.
  const W1 = w + 1;
  const integ = new Int32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += hole[y * w + x];
      integ[(y + 1) * W1 + x + 1] = integ[y * W1 + x + 1] + row;
    }
  }
  const usable = (x: number, y: number) =>
    x >= R && y >= R && x < w - R && y < h - R &&
    integ[(y + R + 1) * W1 + x + R + 1] - integ[(y - R) * W1 + x + R + 1] - integ[(y + R + 1) * W1 + x - R] + integ[(y - R) * W1 + x - R] === 0;

  let remaining = 0;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (hole[y * w + x]) {
        remaining++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (!remaining) return;
  const searchR = Math.max(24, Math.round(Math.max(w, h) * 0.1));

  for (let iter = 0; remaining > 0; iter++) {
    if (iter % 20 === 19) await yieldToUi();

    // Next spot: the hole pixel on the edge whose patch already has the most known pixels.
    let bx = -1, by = -1, bestKnown = -1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (!hole[i]) continue;
        const edge = (x > 0 && !hole[i - 1]) || (x < w - 1 && !hole[i + 1]) || (y > 0 && !hole[i - w]) || (y < h - 1 && !hole[i + w]);
        if (!edge) continue;
        let known = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < w && !hole[yy * w + xx]) known++;
          }
        }
        if (known > bestKnown) {
          bestKnown = known;
          bx = x;
          by = y;
        }
      }
    }
    if (bx < 0) break;

    // Best matching fully-known patch nearby (sum of squared color differences over the known pixels).
    let sx = -1, sy = -1;
    for (let radius = searchR; sx < 0 && radius <= Math.max(w, h); radius *= 2) {
      let bestErr = Infinity;
      const step = radius > searchR ? STEP * 2 : STEP;
      for (let qy = Math.max(R, by - radius); qy <= Math.min(h - R - 1, by + radius); qy += step) {
        for (let qx = Math.max(R, bx - radius); qx <= Math.min(w - R - 1, bx + radius); qx += step) {
          if (!usable(qx, qy)) continue;
          let err = 0;
          for (let dy = -R; dy <= R && err < bestErr; dy++) {
            const ty = by + dy;
            if (ty < 0 || ty >= h) continue;
            for (let dx = -R; dx <= R; dx++) {
              const tx = bx + dx;
              if (tx < 0 || tx >= w) continue;
              const t = ty * w + tx;
              if (hole[t]) continue;
              const s = ((qy + dy) * w + qx + dx) * 4;
              const dr = px[t * 4] - px[s], dg = px[t * 4 + 1] - px[s + 1], db = px[t * 4 + 2] - px[s + 2];
              err += dr * dr + dg * dg + db * db;
            }
          }
          if (err < bestErr) {
            bestErr = err;
            sx = qx;
            sy = qy;
          }
        }
      }
    }

    // Copy the missing pixels of the patch (or, with no source at all, average the known neighbors).
    for (let dy = -R; dy <= R; dy++) {
      const ty = by + dy;
      if (ty < 0 || ty >= h) continue;
      for (let dx = -R; dx <= R; dx++) {
        const tx = bx + dx;
        if (tx < 0 || tx >= w) continue;
        const t = ty * w + tx;
        if (!hole[t]) continue;
        if (sx >= 0) {
          const s = ((sy + dy) * w + sx + dx) * 4;
          px[t * 4] = px[s];
          px[t * 4 + 1] = px[s + 1];
          px[t * 4 + 2] = px[s + 2];
        } else {
          let r = 0, g = 0, b = 0, n = 0;
          for (const o of [t - 1, t + 1, t - w, t + w]) {
            if (o < 0 || o >= w * h || hole[o]) continue;
            r += px[o * 4];
            g += px[o * 4 + 1];
            b += px[o * 4 + 2];
            n++;
          }
          if (!n) continue;
          px[t * 4] = r / n;
          px[t * 4 + 1] = g / n;
          px[t * 4 + 2] = b / n;
        }
        px[t * 4 + 3] = 255;
        hole[t] = 0;
        remaining--;
      }
    }
  }
}

/** Light 3×3 smoothing of the filled pixels, to soften the seams between copied patches. */
function smooth(px: Uint8Array, w: number, h: number, filled: Uint8Array) {
  const src = px.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!filled[i]) continue;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[((y + dy) * w + x + dx) * 4 + c];
        px[i * 4 + c] = sum / 9;
      }
    }
}

/** Removes what the marks cover from `image` (full working resolution; marks are in its pixels). */
export async function inpaint(image: SkImage, marks: EraseMark[]): Promise<SkImage> {
  const W = image.width();
  const H = image.height();
  const k = Math.min(1, WORK_SIDE / Math.max(W, H));
  const w = Math.max(8, Math.round(W * k));
  const h = Math.max(8, Math.round(H * k));
  await yieldToUi();

  const small = await renderImage(<Image image={image} x={0} y={0} width={w} height={h} fit="fill" />, w, h);
  const px = readRgba(small, w, h);
  // The painted area, a bit wider than drawn so the object's edges and shadow go too.
  const maskImg = await renderImage(
    <Group>
      <Fill color="black" />
      {marksElement(marks, k, 1.2)}
    </Group>,
    w,
    h,
  );
  const m = readRgba(maskImg, w, h);
  const hole = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) hole[i] = m[i * 4] > 40 ? 1 : 0;
  const filled = hole.slice();

  await fillHole(px, w, h, hole);
  smooth(px, w, h, filled);

  const patched = Skia.Image.MakeImage(pixelInfo(w, h), Skia.Data.fromBytes(px), w * 4);
  if (!patched) throw new Error('MakeImage');
  // Only the painted area changes, with soft edges so the patch blends into the photo.
  return renderImage(
    <Group>
      <Image image={image} x={0} y={0} width={W} height={H} fit="fill" />
      <Mask mode="alpha" mask={marksElement(marks, 1, 1.25, Math.max(2, Math.round(3 / k)))}>
        <Image image={patched} x={0} y={0} width={W} height={H} fit="fill" />
      </Mask>
    </Group>,
    W,
    H,
  );
}
