import { Image as SkImageNode, type SkImage } from '@shopify/react-native-skia';

import { developFromPatch } from '../develop/patch';
import { DevelopedImage } from '../develop/shader';
import type { Develop } from '../develop/types';
import { renderImage, renderJpegThumbnails, resizeImage } from '../editor/imageOps';
import type { CamFilter } from './registry';

/**
 * CamIA Filters on Skia: one shader pass (src/develop/developSksl.ts) on the GPU, the same for the live preview, the
 * thumbnails and the full-size export. The intensity mixes the filtered pixel with the untouched one
 * (0% = the photo as it was, 100% = the full filter).
 */
const developCache = new Map<string, Develop>();

export function filterDevelop(filter: CamFilter): Develop {
  let d = developCache.get(filter.id);
  if (!d) {
    d = developFromPatch(filter.recipe);
    developCache.set(filter.id, d);
  }
  return d;
}

/** The photo through `filter` (none: the photo itself), filling width×height. */
export function FilteredImage({
  image,
  filter,
  intensity,
  width,
  height,
  fit = 'fill',
}: {
  image: SkImage;
  filter: CamFilter | null;
  intensity: number;
  width: number;
  height: number;
  fit?: 'fill' | 'cover';
}) {
  if (!filter || intensity <= 0) return <SkImageNode image={image} x={0} y={0} width={width} height={height} fit={fit} />;
  return <DevelopedImage image={image} develop={filterDevelop(filter)} width={width} height={height} fit={fit} strength={intensity / 100} />;
}

/** A small copy of the photo for the thumbnails (drawn once, reused for every filter). */
export const thumbnailSource = (image: SkImage, size: number) => resizeImage(image, size * 2);

/**
 * Square JPEG previews of the user's photo through each filter (null: the original), drawn together in one GPU pass.
 * Entries come back in the same order.
 */
export function renderFilterThumbs(small: SkImage, filters: (CamFilter | null)[], size: number) {
  return renderJpegThumbnails(
    filters.map((f) => <FilteredImage key={f?.id ?? 'original'} image={small} filter={f} intensity={f?.intensity ?? 0} width={size} height={size} fit="cover" />),
    size,
  );
}

/** The full-resolution picture with the filter at the chosen intensity, for export. */
export function exportFiltered(full: SkImage, filter: CamFilter | null, intensity: number) {
  const w = full.width();
  const h = full.height();
  return renderImage(<FilteredImage image={full} filter={filter} intensity={intensity} width={w} height={h} />, w, h);
}
