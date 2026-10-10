import {
  drawAsImage,
  drawAsPicture,
  JsiSkImage,
  Fill,
  Group,
  Image,
  ImageFormat,
  LinearGradient,
  rect,
  Rect,
  vec,
  Skia,
  type SkFont,
  type SkImage,
  type SkPicture,
  type SkSVG,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { Scene } from './Scene';
import type { PendingPhoto } from '../pendingPhoto';
import type { Doc } from './types';
import { t } from '../i18n';

/** Working resolution while editing: keeps the canvas and every edit fast on phones. */
export const MAX_SIDE = 2048;
/** Largest original kept for full-resolution export (common GPU texture limit). */
export const FULL_MAX_SIDE = 8192;

/** Above this many pixels, web renders on a throwaway WebGL surface: the CPU path is far too slow for shaders. */
const WEB_GPU_MIN_PIXELS = 1_500_000;

/**
 * Web only: draws a picture on a temporary WebGL surface, copies the pixels back to a CPU image and
 * immediately releases the GL context, so it never competes with the on-screen canvases for the
 * browser's limited number of WebGL contexts. Returns null when WebGL is unavailable.
 */
function renderOnWebGpu(picture: SkPicture, w: number, h: number): SkImage | null {
  const CK = (globalThis as any).CanvasKit;
  const OC = (globalThis as any).OffscreenCanvas;
  if (!CK || !OC) return null;
  const canvas = new OC(w, h);
  const gl = canvas.getContext('webgl2');
  const release = () => gl?.getExtension('WEBGL_lose_context')?.loseContext();
  if (!gl || Math.max(w, h) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) {
    release();
    return null;
  }
  const gr = CK.MakeWebGLContext(CK.GetWebGLContext(canvas));
  const surface = gr && CK.MakeRenderTarget(gr, w, h);
  if (!surface) {
    gr?.delete();
    release();
    return null;
  }
  try {
    surface.getCanvas().drawPicture((picture as any).ref);
    surface.flush();
    const info = {
      width: w,
      height: h,
      alphaType: CK.AlphaType.Premul,
      colorType: CK.ColorType.RGBA_8888,
      colorSpace: CK.ColorSpace.SRGB,
    };
    const pixels = surface.getCanvas().readPixels(0, 0, info);
    const cpu = pixels && CK.MakeImage(info, pixels, w * 4);
    return cpu ? new JsiSkImage(CK, cpu) : null;
  } finally {
    surface.delete();
    gr.delete();
    release();
  }
}

export async function renderImage(element: React.ReactElement, width: number, height: number) {
  const w = Math.round(width);
  const h = Math.round(height);
  if (Platform.OS === 'web') {
    // drawAsImage opens a new WebGL context per call on web, and browsers evict old contexts
    // (including the editor canvas). Small renders use a CPU raster surface; big ones a short-lived GL surface.
    const picture = await drawAsPicture(element, rect(0, 0, w, h));
    if (w * h >= WEB_GPU_MIN_PIXELS) {
      const gpu = renderOnWebGpu(picture, w, h);
      if (gpu) return gpu;
    }
    const surface = Skia.Surface.Make(w, h);
    if (!surface) throw new Error(t('image.cantCreate'));
    surface.getCanvas().drawPicture(picture);
    surface.flush();
    return surface.makeImageSnapshot();
  }
  const img = await drawAsImage(element, { width: w, height: h });
  return img.makeNonTextureImage();
}

/** Small PNG data URI for regular <Image> thumbnails (avoids one Skia canvas per thumbnail). */
export async function renderThumbnail(element: React.ReactElement, width: number, height: number) {
  const img = await renderImage(element, width, height);
  return `data:image/png;base64,${img.encodeToBase64(ImageFormat.PNG, 100)}`;
}

/** Compact JPEG data URI for thumbnails that get stored (drafts, saved recipes). */
export async function renderJpegThumbnail(element: React.ReactElement, width: number, height: number) {
  const img = await renderImage(element, width, height);
  return `data:image/jpeg;base64,${img.encodeToBase64(ImageFormat.JPEG, 82)}`;
}

/** The edited picture (filters, layers, frame) as a small stored thumbnail. */
export function sceneThumbnail(doc: Doc, font: SkFont | null, svgs: Record<string, SkSVG | null>, maxSide = 320) {
  const k = Math.min(1, maxSide / Math.max(doc.image.width(), doc.image.height()));
  return renderJpegThumbnail(
    <Group transform={[{ scale: k }]}>
      <Scene doc={doc} font={font} svgs={svgs} />
    </Group>,
    doc.image.width() * k,
    doc.image.height() * k,
  );
}

export async function resizeImage(img: SkImage, maxSide = MAX_SIDE): Promise<SkImage> {
  const w = img.width();
  const h = img.height();
  const k = Math.min(1, maxSide / Math.max(w, h));
  if (k === 1) return img;
  const nw = Math.round(w * k);
  const nh = Math.round(h * k);
  return renderImage(<Image image={img} x={0} y={0} width={nw} height={nh} fit="fill" />, nw, nh);
}

/** A picture at working resolution plus the full-resolution original it came from (may be the same image). */
export type ImagePair = { image: SkImage; full: SkImage };

export async function pairFromImage(img: SkImage): Promise<ImagePair> {
  const full = await resizeImage(img, FULL_MAX_SIDE);
  return { image: await resizeImage(full, MAX_SIDE), full };
}

/**
 * Web fallback for formats Skia can't decode (AVIF, unusual JPEG/PNG variants…): let the browser decode
 * the picture, then hand Skia a plain JPEG. HEIC only decodes in Safari, so elsewhere it gets a clear message.
 */
async function decodeWithBrowser(uri: string): Promise<SkImage | null> {
  const blob = await (await fetch(uri)).blob();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    if (/hei[cf]/i.test(blob.type)) {
      throw new Error(t('image.heic'));
    }
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (!jpeg) return null;
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(await jpeg.arrayBuffer())));
}

export async function loadPhotoPair(uri: string): Promise<ImagePair> {
  let img = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!img && Platform.OS === 'web') img = await decodeWithBrowser(uri);
  if (!img) throw new Error(t('image.unreadable'));
  return pairFromImage(img);
}

export async function pairFromBase64(b64: string): Promise<ImagePair> {
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(b64));
  if (!img) throw new Error(t('image.unreadableShort'));
  return pairFromImage(img);
}

export async function imageFromBase64(b64: string): Promise<SkImage> {
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(b64));
  if (!img) throw new Error(t('image.badAiImage'));
  return resizeImage(img);
}

/** Blank canvas in a plain color, or a diagonal gradient when given several colors. */
export function blankImage(fill: string | readonly string[], width = 1200, height = 1500) {
  if (typeof fill === 'string') return renderImage(<Fill color={fill} />, width, height);
  return renderImage(
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[...fill]} />
    </Rect>,
    width,
    height,
  );
}

/** Bakes filter, adjustments and every layer into a single image at working resolution. */
export function flatten(doc: Doc, font: SkFont | null, svgs: Record<string, SkSVG | null>) {
  return renderImage(<Scene doc={doc} font={font} svgs={svgs} />, doc.image.width(), doc.image.height());
}

/**
 * Same as flatten, but at the original photo's resolution: the scene (laid out in working pixels) is scaled up
 * and the full-resolution original is drawn in place of the working image, so layers stay crisp vectors.
 */
export function flattenFull(doc: Doc, font: SkFont | null, svgs: Record<string, SkSVG | null>) {
  const full = doc.full;
  if (!full || full === doc.image) return flatten(doc, font, svgs);
  const k = full.width() / doc.image.width();
  return renderImage(
    <Group transform={[{ scale: k }]}>
      <Scene doc={doc} font={font} svgs={svgs} base={full} />
    </Group>,
    full.width(),
    full.height(),
  );
}

export type TransformOp = 'rotateLeft' | 'rotateRight' | 'flip' | 'flipV' | CropRatio;

/** Center crops, as width / height. */
export const cropRatios = { square: 1, portrait: 4 / 5, classic: 3 / 4, story: 9 / 16, landscape: 16 / 9 } as const;
export type CropRatio = keyof typeof cropRatios;

export function transformImage(img: SkImage, op: TransformOp): Promise<SkImage> {
  const w = img.width();
  const h = img.height();
  const draw = (x = 0, y = 0) => <Image image={img} x={x} y={y} width={w} height={h} fit="fill" />;

  switch (op) {
    case 'rotateLeft':
      return renderImage(<Group transform={[{ translateY: w }, { rotate: -Math.PI / 2 }]}>{draw()}</Group>, h, w);
    case 'rotateRight':
      return renderImage(<Group transform={[{ translateX: h }, { rotate: Math.PI / 2 }]}>{draw()}</Group>, h, w);
    case 'flip':
      return renderImage(<Group transform={[{ translateX: w }, { scaleX: -1 }]}>{draw()}</Group>, w, h);
    case 'flipV':
      return renderImage(<Group transform={[{ translateY: h }, { scaleY: -1 }]}>{draw()}</Group>, w, h);
    default: {
      const ratio = cropRatios[op];
      let cw = w;
      let ch = w / ratio;
      if (ch > h) {
        ch = h;
        cw = h * ratio;
      }
      return renderImage(draw(-(w - cw) / 2, -(h - ch) / 2), cw, ch);
    }
  }
}

/** Fraction of each side added as white border for the "expand" AI tool. */
export const EXPAND_PADDING = 0.2;

export function padImage(img: SkImage, fraction = EXPAND_PADDING) {
  const w = img.width();
  const h = img.height();
  const px = Math.round(w * fraction);
  const py = Math.round(h * fraction);
  return renderImage(
    <Group>
      <Fill color="#FFFFFF" />
      <Image image={img} x={px} y={py} width={w} height={h} fit="fill" />
    </Group>,
    w + px * 2,
    h + py * 2,
  );
}

export function encodeBase64(img: SkImage, quality = 92) {
  return img.encodeToBase64(ImageFormat.JPEG, quality);
}

/** Decodes whatever another screen handed over (blank paper is not a photo and is rejected). */
export function loadPendingPair(p: PendingPhoto): Promise<{ image: SkImage; full?: SkImage }> {
  if (p.kind === 'uri') return loadPhotoPair(p.uri);
  if (p.kind === 'base64') return pairFromBase64(p.data);
  if (p.kind === 'image') return Promise.resolve({ image: p.image, full: p.full });
  if (p.kind === 'draft') return Promise.reject(new Error(t('image.draftEditorOnly')));
  return Promise.reject(new Error(t('image.needPhoto')));
}
