import type { Lang } from '../i18n/languages';

/** Blog articles: shared by the server, the admin page and the public blog pages. Times are epoch ms. */

export type BlogStatus = 'draft' | 'published';

/** What lists show. `cover` is a URL ('' when none). */
export type BlogSummary = {
  id: number;
  slug: string;
  lang: Lang;
  title: string;
  description: string;
  cover: string;
  status: BlogStatus;
  /** Keyword group (src/blog/clusters.ts), '' when not set. */
  cluster: string;
  ai: boolean;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  /** Estimated reading time in minutes. */
  minutes: number;
};

/** A whole article; `content` is Markdown (## headings, **bold**, lists, links, ![alt](url) pictures). */
export type BlogPost = BlogSummary & { keywords: string; content: string };

/** Fields the admin can save (new article when id is missing). */
export type BlogDraft = {
  id?: number;
  slug?: string;
  lang: Lang;
  title: string;
  description: string;
  keywords: string;
  content: string;
  cover: string;
  status: BlogStatus;
  cluster?: string;
};

export const BLOG_LENGTHS = {
  short: { label: 'Ngắn (~800 từ)', words: 800 },
  medium: { label: 'Vừa (~1.500 từ)', words: 1500 },
  long: { label: 'Dài (~2.500 từ)', words: 2500 },
} as const;
export type BlogLength = keyof typeof BLOG_LENGTHS;

/** `prompt` is how the AI is told (in English); `label` is what the admin sees. */
export const BLOG_TONES = {
  friendly: { label: 'Thân thiện, gần gũi', prompt: 'friendly and warm, like a helpful friend' },
  expert: { label: 'Chuyên nghiệp', prompt: 'expert and trustworthy, clear and precise' },
  inspiring: { label: 'Truyền cảm hứng', prompt: 'inspiring and creative, full of ideas' },
  fun: { label: 'Vui vẻ, sôi nổi', prompt: 'fun and energetic, light humor, short sentences' },
} as const;
export type BlogTone = keyof typeof BLOG_TONES;

/**
 * Models that write articles: Claude (Anthropic, key CAMI_CLAUDE_API_KEY) by default, Gemini as a cheaper backup.
 * Prices are rough USD per 1M tokens, for the cost estimate on the admin page.
 */
export const BLOG_TEXT_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (hay nhất)', usdIn: 5, usdOut: 25 },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (nhanh hơn, rẻ hơn)', usdIn: 3, usdOut: 15 },
  { id: 'gemini-3.5-flash', name: 'Gemini Flash (rẻ nhất)', usdIn: 0.5, usdOut: 3 },
] as const;
export type BlogTextModel = (typeof BLOG_TEXT_MODELS)[number]['id'];
export const DEFAULT_BLOG_TEXT_MODEL: BlogTextModel = 'claude-opus-5-5';
export const isClaudeModel = (id: string) => id.startsWith('claude-');

export const MAX_BLOG_IMAGES = 4;

export type BlogWriteRequest = {
  lang: Lang;
  topic: string;
  keyword: string;
  length: BlogLength;
  tone: BlogTone;
  images: number;
  extra: string;
  model: BlogTextModel;
  publish: boolean;
  /** The remembered idea this article comes from (marked written once saved). */
  topicId?: number;
  /** Keyword group; the AI picks one when not given. */
  cluster?: string;
};

/** An article being written by AI in the background (admin Blog tab, "Đang viết"). */
export type BlogJob = {
  id: number;
  lang: string;
  topic: string;
  status: 'queued' | 'running' | 'done' | 'error';
  /** What it is doing now, in Vietnamese. */
  step: string;
  postId: number | null;
  error: string;
  createdAt: number;
  updatedAt: number;
};

/** One picture the AI asked for: drawn afterwards and put where the article says [[IMAGE n]]. */
export type BlogImagePlan = { prompt: string; alt: string };

/** Where pictures are served from (files in <data>/blog/). */
export const blogImageUrl = (name: string) => `/api/blog/image/${name}`;

/** Reading time: ~200 words a minute, at least one. */
export const readingMinutes = (markdown: string) => Math.max(1, Math.round(markdown.split(/\s+/).filter(Boolean).length / 200));
