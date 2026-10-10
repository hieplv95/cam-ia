import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { translate, type MessageKey, type Params } from './core';
import { isLang, langFromTag, languages, type Lang } from './languages';
import './locales/all';

export { languages, type Lang } from './languages';
export type { MessageKey } from './core';

/**
 * The app's language: the one the user picked (Profile › Ngôn ngữ), else the phone's, else English.
 * `t()` reads it at call time; components use `useT()` so they re-render when it changes.
 */
const STORAGE_KEY = 'cami-language';

function deviceLanguage(): Lang {
  try {
    for (const l of getLocales()) {
      const lang = langFromTag(l.languageTag) ?? langFromTag(l.languageCode);
      if (lang) return lang;
    }
  } catch {
    // No locale info (server render): English.
  }
  return 'en';
}

let current: Lang = deviceLanguage();
const listeners = new Set<(l: Lang) => void>();

function apply(lang: Lang) {
  current = lang;
  if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l(lang));
}

/** Resolves once the saved choice is loaded (the root layout waits for it, so the first screen is already right). */
export const languageReady: Promise<void> = AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => apply(isLang(saved) ? saved : current))
  .catch(() => {});

export const getLanguage = () => current;

export function setLanguage(lang: Lang) {
  AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  apply(lang);
}

/** Translated text for the current language. */
export const t = (key: MessageKey, params?: Params) => translate(current, key, params);

/** `t` for components: re-renders the component when the language changes. */
export function useT() {
  const [, setLang] = useState(current);
  useEffect(() => {
    listeners.add(setLang);
    return () => {
      listeners.delete(setLang);
    };
  }, []);
  return t;
}

export const languageName = (lang: Lang) => languages.find((l) => l.code === lang)?.name ?? lang;
