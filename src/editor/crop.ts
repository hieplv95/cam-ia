/**
 * Free crop: the frame the user drags over the photo, in image pixels.
 * `ratio` (width / height) keeps the frame's shape when set; null = any shape.
 */
export type CropRect = { x: number; y: number; w: number; h: number };
export type CropCorner = 'nw' | 'ne' | 'sw' | 'se';

/** Smallest frame side, as a fraction of the image's shorter side. */
const MIN_FRACTION = 0.08;

export const minCropSide = (iw: number, ih: number) => Math.max(16, Math.min(iw, ih) * MIN_FRACTION);

/** The largest centered frame with this shape (the whole image for a free crop). */
export function fitCrop(iw: number, ih: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, w: iw, h: ih };
  let w = iw;
  let h = iw / ratio;
  if (h > ih) {
    h = ih;
    w = ih * ratio;
  }
  return { x: (iw - w) / 2, y: (ih - h) / 2, w, h };
}

/** Moves the frame, keeping it inside the image. */
export function moveCrop(start: CropRect, dx: number, dy: number, iw: number, ih: number): CropRect {
  return {
    ...start,
    x: Math.min(iw - start.w, Math.max(0, start.x + dx)),
    y: Math.min(ih - start.h, Math.max(0, start.y + dy)),
  };
}

/**
 * Drags one corner while the opposite corner stays put. With a ratio, the frame keeps its shape:
 * the larger of the two drag directions decides the size.
 */
export function resizeCrop(start: CropRect, corner: CropCorner, dx: number, dy: number, ratio: number | null, iw: number, ih: number): CropRect {
  const min = minCropSide(iw, ih);
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  // The fixed (opposite) corner and the farthest the dragged corner may go.
  const fx = west ? start.x + start.w : start.x;
  const fy = north ? start.y + start.h : start.y;
  const maxW = west ? fx : iw - fx;
  const maxH = north ? fy : ih - fy;

  let w = Math.min(maxW, Math.max(min, start.w + (west ? -dx : dx)));
  let h = Math.min(maxH, Math.max(min, start.h + (north ? -dy : dy)));
  if (ratio) {
    // Follow the direction dragged the most, then fit both sides within the room left.
    if (Math.abs(dx) * start.h >= Math.abs(dy) * start.w) h = w / ratio;
    else w = h * ratio;
    const k = Math.min(1, maxW / w, maxH / h);
    w *= k;
    h *= k;
    if (w < min || h < min) {
      const grow = Math.max(min / w, min / h);
      w = Math.min(maxW, w * grow);
      h = w / ratio;
    }
  }
  return { x: west ? fx - w : fx, y: north ? fy - h : fy, w, h };
}

/** True when the frame covers (almost) the whole image: nothing to crop. */
export const isFullCrop = (r: CropRect, iw: number, ih: number) => r.x < 1 && r.y < 1 && r.w > iw - 2 && r.h > ih - 2;

export const scaleCrop = (r: CropRect, k: number): CropRect => ({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
