import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { presetById, type DevelopPreset } from './presets';
import type { Develop } from './types';
import { t } from '../i18n';
import { track } from '../track';

/** The user's own color recipes ("Công thức của tôi"), kept on the device. */
type Stored = { id: string; name: string; develop: Develop; thumb: string; createdAt: number };

const KEY = 'custom-presets';
const MAX_CUSTOM = 40;

let cache: DevelopPreset[] | null = null;
let loading: Promise<DevelopPreset[]> | null = null;
const listeners = new Set<(list: DevelopPreset[]) => void>();

const toPreset = (s: Stored): DevelopPreset => ({
  id: s.id,
  name: s.name,
  categories: [],
  develop: s.develop,
  thumb: s.thumb,
  custom: true,
});

const toStored = (p: DevelopPreset, createdAt: number): Stored => ({ id: p.id, name: p.name, develop: p.develop!, thumb: p.thumb ?? '', createdAt });

async function write(list: DevelopPreset[]) {
  cache = list;
  listeners.forEach((l) => l(list));
  await AsyncStorage.setItem(KEY, JSON.stringify(list.map((p, i) => toStored(p, list.length - i))));
}

export function loadCustomPresets(): Promise<DevelopPreset[]> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(KEY)
    .then((v) => (v ? (JSON.parse(v) as Stored[]).map(toPreset) : []))
    .catch(() => [])
    .then((list) => {
      cache = list;
      return list;
    });
  return loading;
}

/** Saves the settings as a new recipe (newest first) and returns it. */
export async function addCustomPreset(name: string, develop: Develop, thumb: string) {
  const list = await loadCustomPresets();
  const preset = toPreset({ id: `my-${Date.now().toString(36)}`, name: name.trim() || t('recipe.defaultName'), develop, thumb, createdAt: Date.now() });
  const next = [preset, ...list].slice(0, MAX_CUSTOM);
  try {
    await write(next);
  } catch {
    throw new Error(t('recipe.storageFull'));
  }
  track('recipe_save');
  return preset;
}

export async function removeCustomPreset(id: string) {
  await write((await loadCustomPresets()).filter((p) => p.id !== id));
}

/** Built-in or custom preset by id (custom ones must have been loaded, which every screen listing them does). */
export const findPreset = (id: string) => presetById(id) ?? cache?.find((p) => p.id === id);

export function useCustomPresets() {
  const [list, setList] = useState<DevelopPreset[]>(cache ?? []);
  useEffect(() => {
    listeners.add(setList);
    loadCustomPresets().then(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

/** A default name that doesn't clash with existing recipes. */
export function nextRecipeName(list: DevelopPreset[]) {
  let n = list.length + 1;
  while (list.some((p) => p.name === t('recipe.numbered', { n }))) n++;
  return t('recipe.numbered', { n });
}
