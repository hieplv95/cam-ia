import type { SkImage } from '@shopify/react-native-skia';

import type { AiPresetId } from './ai/presets';
import type { StudioToolId } from './ai/studio';

/** What the editor should do right after the photo opens. */
export type EditorIntent =
  | { type: 'ai'; preset: AiPresetId }
  /** Opens the dedicated Retouch screen instead of the editor. */
  | { type: 'retouch' }
  /** Opens the manual color/light adjustment screen. */
  | { type: 'adjust'; preset?: string; intensity?: number }
  /** Opens one of the featured AI tools (Studio screen) with the photo. */
  | { type: 'studio'; tool: StudioToolId };

/** Hands the chosen photo from other screens to the editor without stuffing large data into route params. */
export type PendingPhoto = (
  | { kind: 'uri'; uri: string }
  | { kind: 'base64'; data: string }
  /** Already decoded, optionally with its full-resolution original. */
  | { kind: 'image'; image: SkImage; full?: SkImage }
  /** Blank canvas: a color (or gradient colors) and a size in pixels. */
  | { kind: 'blank'; color: string; gradient?: readonly string[]; width?: number; height?: number }
  /** A saved draft, reopened with all its edits. */
  | { kind: 'draft'; id: string }
) & { intent?: EditorIntent };

let pending: PendingPhoto | null = null;

export const setPendingPhoto = (p: PendingPhoto) => {
  pending = p;
};

export const takePendingPhoto = () => {
  const p = pending;
  pending = null;
  return p;
};

/** The finished picture handed to the Export screen, kept as a decoded image to avoid re-compressing it. */
let pendingExport: SkImage | null = null;

export const setPendingExport = (img: SkImage) => {
  pendingExport = img;
};

export const takePendingExport = () => {
  const img = pendingExport;
  pendingExport = null;
  return img;
};

/** Photos picked for "Ghép ảnh" (several at once), handed to that screen. */
let pendingCombine: string[] = [];

export const setPendingCombine = (uris: string[]) => {
  pendingCombine = uris;
};

export const takePendingCombine = () => {
  const uris = pendingCombine;
  pendingCombine = [];
  return uris;
};
