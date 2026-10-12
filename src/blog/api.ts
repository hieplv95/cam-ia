import { apiFetch } from '../account';
import type { Lang } from '../i18n/languages';
import type { BlogPost, BlogSummary } from './types';

/** Public blog reads (the admin side is in src/admin/api.ts). */

export async function fetchPosts(lang: Lang, limit = 50): Promise<BlogSummary[]> {
  const { ok, data } = await apiFetch(`/api/blog?lang=${lang}&limit=${limit}`);
  if (!ok) throw new Error(data?.error ?? 'blog');
  return data.posts as BlogSummary[];
}

/** null when the article doesn't exist or isn't published. */
export async function fetchPost(slug: string): Promise<BlogPost | null> {
  const { ok, status, data } = await apiFetch(`/api/blog?slug=${encodeURIComponent(slug)}`);
  if (status === 404) return null;
  if (!ok) throw new Error(data?.error ?? 'blog');
  return data.post as BlogPost;
}

/** "11 oct 2026" in the reader's language. */
export function postDate(t: number | null, lang: Lang) {
  if (!t) return '';
  try {
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(t);
  } catch {
    return new Date(t).toLocaleDateString();
  }
}
