import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Recently saved pictures, kept small (≈720px JPEG) so they fit in AsyncStorage / localStorage. */
export type Recent = { id: string; data: string; createdAt: number };

const KEY = 'recent-pictures';
const MAX_RECENTS = 12;

export async function getRecents(): Promise<Recent[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  } catch {
    return [];
  }
}

export async function addRecent(data: string) {
  const list = await getRecents();
  const next = [{ id: Date.now().toString(36), data, createdAt: Date.now() }, ...list].slice(0, MAX_RECENTS);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full: keep fewer pictures rather than failing the save.
    await AsyncStorage.setItem(KEY, JSON.stringify(next.slice(0, 4)));
  }
}

export async function clearRecents() {
  await AsyncStorage.removeItem(KEY);
}

export function useRecents() {
  const [recents, setRecents] = useState<Recent[]>([]);
  const reload = useCallback(() => {
    getRecents().then(setRecents);
  }, []);
  useFocusEffect(reload);
  return { recents, reload };
}
