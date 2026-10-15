import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Server-side picture work for the blog (resize, Camia.app signature, JPEG) with CanvasKit, the WebAssembly Skia
 * that ships with @shopify/react-native-skia. Loaded at run time (not bundled) and only once, the first time it is used.
 * Same layout as the app's export signature (src/signature.tsx).
 */

type CK = any;
const g = globalThis as unknown as { __camiCanvasKit?: Promise<CK>; __camiSignature?: unknown };

/** Shared with the old-photo crop (printCrop.ts). */
export function canvasKit(): Promise<CK> {
  if (!g.__camiCanvasKit) {
    const dir = path.join(process.cwd(), 'node_modules', 'canvaskit-wasm', 'bin', 'full');
    // A require made at run time, so the server bundle doesn't try to pack the WebAssembly loader.
    const load = createRequire(path.join(process.cwd(), 'package.json'))(path.join(dir, 'canvaskit.js'));
    g.__camiCanvasKit = load({ locateFile: (file: string) => path.join(dir, file) });
  }
  return g.__camiCanvasKit!;
}

async function signature(ck: CK) {
  if (!g.__camiSignature) {
    g.__camiSignature = ck.MakeImageFromEncoded(readFileSync(path.join(process.cwd(), 'assets', 'images', 'brand', 'camia-signature.png')));
  }
  return g.__camiSignature as any;
}

/** A picture (base64 PNG/JPEG) resized to at most `maxSide`, signed with Camia.app when `logo`, as JPEG base64. */
export async function stampJpeg(base64: string, logo: boolean, maxSide = 1600, quality = 86): Promise<string> {
  const ck = await canvasKit();
  const img = ck.MakeImageFromEncoded(Buffer.from(base64, 'base64'));
  if (!img) throw new Error('Không đọc được ảnh AI vừa vẽ.');
  const k = Math.min(1, maxSide / Math.max(img.width(), img.height()));
  const w = Math.round(img.width() * k);
  const h = Math.round(img.height() * k);
  const surface = ck.MakeSurface(w, h);
  if (!surface) throw new Error('Không tạo được ảnh.');
  try {
    const canvas = surface.getCanvas();
    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    canvas.drawImageRectOptions(img, ck.XYWHRect(0, 0, img.width(), img.height()), ck.XYWHRect(0, 0, w, h), ck.FilterMode.Linear, ck.MipmapMode.Linear, paint);
    if (logo) {
      const sig = await signature(ck);
      const side = Math.min(w, h);
      const lw = side * 0.34;
      const lh = (lw * sig.height()) / sig.width();
      const margin = side * 0.035;
      const sp = new ck.Paint();
      sp.setAntiAlias(true);
      sp.setAlphaf(0.95);
      // A soft shadow keeps the white script readable on light photos.
      sp.setImageFilter(ck.ImageFilter.MakeDropShadow(0, side * 0.002, side * 0.003, side * 0.003, ck.Color(0, 0, 0, 0.45), null));
      canvas.drawImageRectOptions(sig, ck.XYWHRect(0, 0, sig.width(), sig.height()), ck.XYWHRect(w - lw - margin, h - lh - margin * 0.6, lw, lh), ck.FilterMode.Linear, ck.MipmapMode.Linear, sp);
      sp.delete();
    }
    paint.delete();
    const bytes = surface.makeImageSnapshot().encodeToBytes(ck.ImageFormat.JPEG, quality);
    if (!bytes) throw new Error('Không nén được ảnh.');
    return Buffer.from(bytes).toString('base64');
  } finally {
    surface.delete();
    img.delete();
  }
}
