import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'filter-favorites';

/** The CamIA Filters the user starred (ids, newest first), kept on the device. */
export function useFilterFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setFavorites(v ? JSON.parse(v) : []))
      .catch(() => {});
  }, []);
  const toggle = useCallback((id: string) => {
    setFavorites((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { favorites, toggle };
}
