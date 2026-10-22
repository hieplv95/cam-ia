// Renders CamIA Filters with the app's own shader on the CPU (CanvasKit in Node), for the tests and for tuning.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEVELOP_SKSL, developUniforms, flatUniforms } from '../src/develop/developSksl';
import { developFromPatch } from '../src/develop/patch';
import type { CamFilter } from '../src/filters/registry';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CK = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Img = any;

let ck: Promise<CK> | null = null;
export function canvasKit(): Promise<CK> {
  const dir = path.join(root, 'node_modules/canvaskit-wasm/bin/full/');
  ck ??= require(dir + 'canvaskit.js')({ locateFile: (f: string) => dir + f });
  return ck!;
}

/** Test photos shipped with the app (portraits, product, beach, night). */
export const labPhotos = {
  portrait: 'assets/images/models/white.jpg',
  smile: 'assets/images/models/peace.jpg',
  vanity: 'assets/images/models/vanity.jpg',
  product: 'assets/images/featured/product.jpg',
  beach: 'assets/images/presets/bahia.jpg',
  night: 'assets/images/presets/neonnight.jpg',
};

export async function loadPhoto(file: string, maxSide = 300): Promise<Img> {
  const CK = await canvasKit();
  const img = CK.MakeImageFromEncoded(readFileSync(path.isAbsolute(file) ? file : path.join(root, file)));
  if (!img) throw new Error(`cannot decode ${file}`);
  const k = Math.min(1, maxSide / Math.max(img.width(), img.height()));
  return k < 1 ? draw(img, Math.round(img.width() * k), Math.round(img.height() * k)) : img;
}

/** Draws `img` scaled into a new w×h picture, optionally through a shader paint. */
async function draw(img: Img, w: number, h: number, paintFor?: (CK: CK) => unknown): Promise<Img> {
  const CK = await canvasKit();
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  if (paintFor) canvas.drawRect(CK.LTRBRect(0, 0, w, h), paintFor(CK));
  else canvas.drawImageRect(img, CK.LTRBRect(0, 0, img.width(), img.height()), CK.LTRBRect(0, 0, w, h), new CK.Paint());
  const out = surface.makeImageSnapshot();
  return out;
}

let effect: unknown = null;

/** The photo through a filter at the given intensity (0–100), with the app's shader. */
export async function applyFilter(img: Img, filter: CamFilter | null, intensity = filter?.intensity ?? 100): Promise<Img> {
  if (!filter) return img;
  const CK = await canvasKit();
  effect ??= CK.RuntimeEffect.Make(DEVELOP_SKSL);
  if (!effect) throw new Error('develop shader did not compile');
  const w = img.width();
  const h = img.height();
  const uniforms = flatUniforms(developUniforms(developFromPatch(filter.recipe), w, h, intensity / 100));
  return draw(img, w, h, (CK) => {
    const child = img.makeShaderOptions(CK.TileMode.Clamp, CK.TileMode.Clamp, CK.FilterMode.Linear, CK.MipmapMode.None);
    const paint = new CK.Paint();
    paint.setShader((effect as { makeShaderWithChildren: (u: number[], c: unknown[]) => unknown }).makeShaderWithChildren(uniforms, [child]));
    return paint;
  });
}

/** RGBA bytes (not premultiplied). */
export async function pixels(img: Img): Promise<Uint8Array> {
  const CK = await canvasKit();
  return img.readPixels(0, 0, {
    width: img.width(),
    height: img.height(),
    colorType: CK.ColorType.RGBA_8888,
    alphaType: CK.AlphaType.Unpremul,
    colorSpace: CK.ColorSpace.SRGB,
  });
}

/** Mean absolute difference per color channel (0–255) between two same-size pictures. */
export async function difference(a: Img, b: Img): Promise<number> {
  const pa = await pixels(a);
  const pb = await pixels(b);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < pa.length; i += 4) {
    sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
    n += 3;
  }
  return sum / n;
}

/** A grid of pictures (rows of equal-size cells) as PNG bytes. */
export async function sheet(rows: Img[][], cellW: number, cellH: number, gap = 4): Promise<Uint8Array> {
  const CK = await canvasKit();
  const cols = Math.max(...rows.map((r) => r.length));
  const surface = CK.MakeSurface(cols * (cellW + gap) + gap, rows.length * (cellH + gap) + gap);
  const canvas = surface.getCanvas();
  canvas.clear(CK.Color(30, 30, 30, 1));
  const paint = new CK.Paint();
  rows.forEach((row, y) =>
    row.forEach((img, x) => {
      // Cover-crop into the cell.
      const k = Math.max(cellW / img.width(), cellH / img.height());
      const sw = cellW / k;
      const sh = cellH / k;
      const sx = (img.width() - sw) / 2;
      const sy = (img.height() - sh) / 2;
      const dx = gap + x * (cellW + gap);
      const dy = gap + y * (cellH + gap);
      canvas.drawImageRect(img, CK.LTRBRect(sx, sy, sx + sw, sy + sh), CK.LTRBRect(dx, dy, dx + cellW, dy + cellH), paint);
    }),
  );
  return surface.makeImageSnapshot().encodeToBytes();
}
