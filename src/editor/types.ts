import type { SkImage } from '@shopify/react-native-skia';

import type { Develop } from '../develop/types';
import type { FrameId } from './frames';
import type { FontId, TextStyleId } from './text';

export type PenKind = 'normal' | 'neon' | 'rainbow';

/** All layer coordinates and sizes are in image pixels, so export is resolution-independent. */
export type StickerLayer = {
  kind: 'sticker';
  id: string;
  stickerId: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
};

export type TextLayer = {
  kind: 'text';
  id: string;
  /** May hold several lines ("\n"). */
  text: string;
  color: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  /** Missing in drafts saved before fonts and looks existed: Baloo with a white border. */
  font?: FontId;
  style?: TextStyleId;
};

export type StrokeLayer = {
  kind: 'stroke';
  id: string;
  /** Flat [x0, y0, x1, y1, ...] list. */
  points: number[];
  color: string;
  width: number;
  pen: PenKind;
};

export type RetouchEffect = 'whiten' | 'lighten' | 'lips' | 'blush' | 'brows';

/**
 * A brush stroke marking what the AI should remove ("Xóa vật thể"), in image pixels.
 * Kept outside the document: never saved or exported, only drawn over the photo sent to the AI.
 */
export type EraseMark = { points: number[]; width: number };

/** Brushed area where a free retouch effect applies (teeth whitening, under-eye lightening). */
export type RetouchLayer = {
  kind: 'retouch';
  id: string;
  points: number[];
  width: number;
  effect: RetouchEffect;
};

export type Layer = StickerLayer | TextLayer | StrokeLayer | RetouchLayer;
export type TransformableLayer = StickerLayer | TextLayer;

export type Adjust = { brightness: number; contrast: number; saturation: number };

export const defaultAdjust: Adjust = { brightness: 0, contrast: 1, saturation: 1 };

export type Doc = {
  /** Working-resolution picture; all layer coordinates are in its pixels. */
  image: SkImage;
  /** Full-resolution original of the same picture, used only for export. */
  full?: SkImage;
  /** Light, color, detail and look settings, rendered live by the develop shader. */
  develop: Develop;
  /** Last preset applied from the Filters tab, so its strength can still be changed. */
  preset?: { id: string; intensity: number };
  frame: FrameId;
  layers: Layer[];
  /** Name of the operation that produced this picture (AI, crop…), shown in the edit history. */
  step?: string;
};

export const newId = () => Math.random().toString(36).slice(2, 10);
