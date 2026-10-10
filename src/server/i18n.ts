import '../i18n/locales/all';
import { translate, type MessageKey, type Params } from '../i18n/core';
import { langFromTag, type Lang } from '../i18n/languages';

/** The caller's language: the app sends x-cami-lang; browsers calling directly send Accept-Language. */
export function langOf(request: Request): Lang {
  return langFromTag(request.headers.get('x-cami-lang')) ?? langFromTag(request.headers.get('accept-language')) ?? 'en';
}

/** A server message in the caller's language. */
export const tr = (request: Request, key: MessageKey, params?: Params) => translate(langOf(request), key, params);
