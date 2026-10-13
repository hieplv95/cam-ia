import { isLang, type Lang } from '../i18n/languages';
import { DEFAULT_GEO, DEFAULT_SEO, GEO_LIMITS, SEO_LANGS, SEO_LIMITS, SOCIAL_KEYS, type GeoSettings, type SeoFaq, type SeoSettings, type SeoText } from '../seo';
import { getSetting, setSetting } from './db';

/** Website search texts (admin SEO tab), stored as JSON in settings; languages never saved use the defaults. */

const SEO_KEY = 'seo';

function mergeGeo(saved: Partial<GeoSettings> | undefined): GeoSettings {
  const about = { ...DEFAULT_GEO.about };
  const faq = { ...DEFAULT_GEO.faq };
  for (const lang of SEO_LANGS) {
    if (typeof saved?.about?.[lang] === 'string') about[lang] = saved.about[lang];
    if (Array.isArray(saved?.faq?.[lang])) faq[lang] = saved.faq[lang];
  }
  return {
    about,
    faq,
    allowTraining: typeof saved?.allowTraining === 'boolean' ? saved.allowTraining : DEFAULT_GEO.allowTraining,
    social: { ...DEFAULT_GEO.social, ...(saved?.social ?? {}) },
  };
}

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
    geo: mergeGeo(saved.geo),
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
/** Keeps paragraph breaks (the about text may have several paragraphs). */
const cleanBlock = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/\r\n?/g, '\n')
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n\n')
    : '';

function cleanGeo(input: Record<string, unknown>, current: GeoSettings): GeoSettings {
  const next: GeoSettings = { ...current, about: { ...current.about }, faq: { ...current.faq }, social: { ...current.social } };
  if (typeof input.allowTraining === 'boolean') next.allowTraining = input.allowTraining;
  const about = (input.about && typeof input.about === 'object' ? input.about : {}) as Record<string, unknown>;
  for (const [lang, text] of Object.entries(about)) {
    if (!isLang(lang)) continue;
    const value = cleanBlock(text);
    if (value.length > GEO_LIMITS.about) throw new SeoSettingsError(`${lang.toUpperCase()}: phần giới thiệu dài quá ${GEO_LIMITS.about} ký tự.`);
    next.about[lang] = value;
  }
  const faq = (input.faq && typeof input.faq === 'object' ? input.faq : {}) as Record<string, unknown>;
  for (const [lang, list] of Object.entries(faq)) {
    if (!isLang(lang) || !Array.isArray(list)) continue;
    const items: SeoFaq[] = list
      .map((x) => ({ q: clean((x as SeoFaq)?.q), a: cleanBlock((x as SeoFaq)?.a) }))
      .filter((x) => x.q || x.a);
    if (items.length > GEO_LIMITS.faqItems) throw new SeoSettingsError(`${lang.toUpperCase()}: tối đa ${GEO_LIMITS.faqItems} câu hỏi.`);
    for (const it of items) {
      if (!it.q || !it.a) throw new SeoSettingsError(`${lang.toUpperCase()}: mỗi câu hỏi cần có cả câu hỏi và câu trả lời.`);
      if (it.q.length > GEO_LIMITS.question || it.a.length > GEO_LIMITS.answer) {
        throw new SeoSettingsError(`${lang.toUpperCase()}: câu hỏi tối đa ${GEO_LIMITS.question} ký tự, câu trả lời tối đa ${GEO_LIMITS.answer}.`);
      }
    }
    next.faq[lang] = items;
  }
  const social = (input.social && typeof input.social === 'object' ? input.social : {}) as Record<string, unknown>;
  for (const key of SOCIAL_KEYS) {
    if (social[key] === undefined) continue;
    const url = clean(social[key]);
    if (url && (!/^https:\/\/[^\s<>"]+$/.test(url) || url.length > GEO_LIMITS.url)) throw new SeoSettingsError(`Link ${key} phải là địa chỉ https:// đầy đủ.`);
    next.social[key] = url;
  }
  return next;
}

/** Saves what the admin typed: { primary?, verification?, texts?: { es: { title, description, keywords }, … }, geo? }. */
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
  if (o.geo && typeof o.geo === 'object') next.geo = cleanGeo(o.geo as Record<string, unknown>, next.geo);
  setSetting(SEO_KEY, JSON.stringify(next));
  return next;
}
