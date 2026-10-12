import { isLang, type Lang } from '../i18n/languages';
import { DEFAULT_SEO, SEO_LANGS, SEO_LIMITS, type SeoSettings, type SeoText } from '../seo';
import { getSetting, setSetting } from './db';

/** Website search texts (admin SEO tab), stored as JSON in settings; languages never saved use the defaults. */

const SEO_KEY = 'seo';

export function getSeo(): SeoSettings {
  const raw = getSetting(SEO_KEY);
  if (!raw) return DEFAULT_SEO;
  const saved = JSON.parse(raw) as Partial<SeoSettings>;
  const texts = { ...DEFAULT_SEO.texts };
  for (const lang of SEO_LANGS) if (saved.texts?.[lang]) texts[lang] = { ...DEFAULT_SEO.texts[lang], ...saved.texts[lang] };
  return {
    primary: isLang(saved.primary) ? saved.primary : DEFAULT_SEO.primary,
    verification: typeof saved.verification === 'string' ? saved.verification : '',
    texts,
  };
}

export class SeoSettingsError extends Error {}

/** Accepts the bare code or the whole tag Search Console gives (<meta name="google-site-verification" content="…">). */
export function verificationCode(input: string) {
  const text = input.trim();
  if (!text) return '';
  const code = text.match(/content\s*=\s*["']([^"']+)["']/i)?.[1] ?? text;
  if (!/^[\w-]{10,100}$/.test(code)) throw new SeoSettingsError('Mã xác minh Google không hợp lệ: dán đúng mã hoặc cả thẻ <meta name="google-site-verification" …>.');
  return code;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Saves what the admin typed: { primary?, verification?, texts?: { es: { title, description, keywords }, … } }. */
export function setSeo(input: unknown): SeoSettings {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const next = getSeo();
  if (o.primary !== undefined) {
    if (!isLang(o.primary)) throw new SeoSettingsError('Ngôn ngữ chính không hợp lệ.');
    next.primary = o.primary;
  }
  if (o.verification !== undefined) next.verification = verificationCode(String(o.verification));
  const texts = (o.texts && typeof o.texts === 'object' ? o.texts : {}) as Record<string, Partial<Record<keyof SeoText, unknown>>>;
  for (const [lang, t] of Object.entries(texts)) {
    if (!isLang(lang) || !t) continue;
    const text: SeoText = { title: clean(t.title), description: clean(t.description), keywords: clean(t.keywords) };
    if (!text.title || !text.description) throw new SeoSettingsError(`${lang.toUpperCase()}: cần có tiêu đề và mô tả.`);
    for (const k of ['title', 'description', 'keywords'] as const) {
      if (text[k].length > SEO_LIMITS[k]) throw new SeoSettingsError(`${lang.toUpperCase()}: ${k} dài quá ${SEO_LIMITS[k]} ký tự.`);
    }
    next.texts[lang as Lang] = text;
  }
  setSetting(SEO_KEY, JSON.stringify(next));
  return next;
}
