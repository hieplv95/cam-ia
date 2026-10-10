import { type Lang } from './languages';
import vi from './locales/vi';

/** Shared by the app and the API routes (no React or device APIs in here). */
export type MessageKey = keyof typeof vi;
export type Messages = Record<MessageKey, string>;
export type Params = Record<string, string | number>;

const dictionaries: Partial<Record<Lang, Messages>> = { vi };

/** Registers a language's messages (each locale file calls this once). */
export const addMessages = (lang: Lang, messages: Messages) => {
  dictionaries[lang] = messages;
};

export const isMessageKey = (k: unknown): k is MessageKey => typeof k === 'string' && k in vi;

/** The message in `lang`, falling back to English, then Vietnamese; {name} placeholders filled from `params`. */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const msg = dictionaries[lang]?.[key] ?? dictionaries.en?.[key] ?? vi[key] ?? key;
  return params ? msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : msg;
}
