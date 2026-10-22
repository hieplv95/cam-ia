import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SkImage } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Doc } from '../editor/types';
import { deleteBlob, getBlob, putBlob } from './blobStore';
import { t } from '../i18n';

/**
 * Drafts let the user leave the editor and pick up later. The pictures go to a blob store (files / IndexedDB);
 * the edits themselves (develop settings, layers, frame) are small JSON next to a thumbnail in AsyncStorage.
 */
export type DraftMeta = { id: string; thumb: string; updatedAt: number };
type DraftData = Pick<Doc, 'develop' | 'preset' | 'frame' | 'layers'> & { hasFull: boolean };

const INDEX_KEY = 'drafts';
const dataKey = (id: string) => `draft-${id}`;
const MAX_DRAFTS = 20;

export async function listDrafts(): Promise<DraftMeta[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

// Skia is only needed to save or open a draft (from the editor), not to list them on the home screen, which on the
// web shows before Skia has loaded (see src/skia.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const skia = (): typeof import('@shopify/react-native-skia') => require('@shopify/react-native-skia');

/** Encoding a 2048px picture takes a moment, so each image is encoded once and reused by later saves. */
const encoded = new WeakMap<SkImage, Uint8Array>();
const written = new Map<string, SkImage>();

async function storeImage(key: string, img: SkImage) {
  if (written.get(key) === img) return;
  let bytes = encoded.get(img);
  if (!bytes) {
    bytes = img.encodeToBytes(skia().ImageFormat.JPEG, 95);
    encoded.set(img, bytes);
  }
  await putBlob(key, bytes);
  written.set(key, img);
}

export const newDraftId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Saves (or overwrites) a draft. `thumb` is a small data URI of the edited picture. */
export async function saveDraft(id: string, doc: Doc, thumb: string) {
  const hasFull = !!doc.full && doc.full !== doc.image;
  await storeImage(`${id}-image`, doc.image);
  if (hasFull) await storeImage(`${id}-full`, doc.full!);
  const data: DraftData = { develop: doc.develop, preset: doc.preset, frame: doc.frame, layers: doc.layers, hasFull };
  await AsyncStorage.setItem(dataKey(id), JSON.stringify(data));

  const list = (await listDrafts()).filter((d) => d.id !== id);
  const next = [{ id, thumb, updatedAt: Date.now() }, ...list];
  for (const old of next.splice(MAX_DRAFTS)) await deleteDraft(old.id, false);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
}

const decode = (bytes: Uint8Array | null) => {
  if (!bytes) return null;
  const { Skia } = skia();
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
};

export async function loadDraft(id: string): Promise<Doc> {
  const raw = await AsyncStorage.getItem(dataKey(id));
  const image = decode(await getBlob(`${id}-image`));
  if (!raw || !image) throw new Error(t('drafts.gone'));
  const data: DraftData = JSON.parse(raw);
  const full = data.hasFull ? (decode(await getBlob(`${id}-full`)) ?? undefined) : undefined;
  // What is on disk now matches these images; the next save can skip re-writing them.
  written.set(`${id}-image`, image);
  if (full) written.set(`${id}-full`, full);
  return { image, full, develop: data.develop, preset: data.preset, frame: data.frame, layers: data.layers };
}

export async function deleteDraft(id: string, updateIndex = true) {
  await Promise.all([deleteBlob(`${id}-image`), deleteBlob(`${id}-full`), AsyncStorage.removeItem(dataKey(id))]).catch(() => {});
  written.delete(`${id}-image`);
  written.delete(`${id}-full`);
  if (updateIndex) await AsyncStorage.setItem(INDEX_KEY, JSON.stringify((await listDrafts()).filter((d) => d.id !== id)));
}

export function useDrafts() {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const reload = useCallback(() => {
    listDrafts().then(setDrafts);
  }, []);
  useFocusEffect(reload);
  return { drafts, reload };
}

/** "5 phút trước", "Hôm qua"… */
export function timeAgo(at: number) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return t('time.justNow');
  if (m < 60) return t('time.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('time.hours', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t('time.yesterday') : t('time.days', { n: d });
}
