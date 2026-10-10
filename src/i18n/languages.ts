/** The 10 languages Cami speaks, in the order shown in the language picker. */
export const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文（简体）' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
] as const;

export type Lang = (typeof languages)[number]['code'];

export const isLang = (v: unknown): v is Lang => languages.some((l) => l.code === v);

/** Best match for a language tag such as "pt-BR" or "zh-Hans-CN", or null when Cami doesn't speak it. */
export function langFromTag(tag: string | null | undefined): Lang | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : null;
}
