import { BLOG_LENGTHS, BLOG_TEXT_MODELS, BLOG_TONES, isClaudeModel, MAX_BLOG_IMAGES, type BlogImagePlan, type BlogWriteRequest } from '../blog/types';
import { BLOG_CLUSTERS, isClusterId, MAX_PER_CLUSTER } from '../blog/clusters';
import { languages, type Lang } from '../i18n/languages';
import { avoidList, coverage, saveSuggestions } from './blogTopics';
import { claudeText } from './claude';
import { editImage, generateText } from './gemini';

/** Claude models go to Anthropic, the others to Gemini (in JSON mode). */
const writeText = (prompt: string, system: string, opts: { model?: string; timeoutMs?: number }) =>
  opts.model && isClaudeModel(opts.model) ? claudeText(prompt, system, opts) : generateText(prompt, system, { ...opts, json: true });

/**
 * AI help for the blog: topic ideas, whole articles (Markdown + where pictures go) and the pictures themselves.
 * Articles promote CamIA, so the model gets the real list of features and must not invent others.
 */

const languageName = (l: Lang) => languages.find((x) => x.code === l)?.name ?? l;

/** What CamIA really does (from the app), so articles never promise features it doesn't have. */
const PRODUCT = `CamIA (https://camia.app) is a free AI photo editor that runs in the browser on phone or computer (no download), and as an Android/iOS app.
Features:
- AI edits by describing what you want in your own words ("make the sky blue", "remove the person on the left").
- Restore old photos: fix scratches, sharpen faces, colorize black-and-white photos.
- AI object remover (brush over what to erase) and a quick erase without AI.
- Remove background / white background for product photos.
- AI Product Studio: professional product shots with new backgrounds and scenes; can split several products into separate photos.
- Logo maker: create a logo from a brand name or from a reference sketch/photo.
- AI Hairstyle & Makeup: try hairstyles, hair colors and makeup looks on a selfie.
- Enhance (sharper, better light), expand the photo beyond the frame, photo to art (anime, watercolor, cartoon…), AI image generator from text.
- Full manual editor: crop, light, color, curves, HSL, detail, film looks; presets inspired by Latin America (Cancún, Havana, Tulum, Rio, Frida, Mariachi…), cinematic and black & white.
- Text, stickers, drawing, frames; undo history; free crop; export JPG/PNG up to the original resolution, optional Camia.app signature, share straight to WhatsApp, Instagram or TikTok.
- Works in 10 languages (Spanish, Portuguese, English, Vietnamese, French, German, Russian, Chinese, Japanese, Korean).
Pricing: free monthly points; guests get a few free AI tries.`;

/** Rough USD cost of a text call (shown on the admin page with the other AI costs). */
export function textCost(model: string, inTokens: number, outTokens: number) {
  const m = BLOG_TEXT_MODELS.find((x) => x.id === model) ?? BLOG_TEXT_MODELS[0];
  return (inTokens * m.usdIn + outTokens * m.usdOut) / 1_000_000;
}

/** Index just past the `}` closing the object that opens at `start` (strings and escapes skipped), or -1. */
function objectEnd(text: string, start: number) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Strips a ```json fence and parses; if there is text around the JSON, keeps the first whole object
 * (models sometimes add a note or a second copy of the object after it).
 */
function parseJson<T>(text: string): T {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  const start = clean.indexOf('{');
  const candidates = start > 0 ? [clean, clean.slice(start)] : [clean];
  for (const text of candidates) {
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      // "Unexpected non-whitespace character after JSON at position N": a whole object, then something else.
      const after = /after JSON at position (\d+)/.exec(e instanceof Error ? e.message : '');
      if (after) {
        try {
          return JSON.parse(text.slice(0, Number(after[1]))) as T;
        } catch {}
      }
    }
  }
  const end = start < 0 ? -1 : objectEnd(clean, start);
  try {
    if (end > 0) return JSON.parse(clean.slice(start, end)) as T;
  } catch {}
  throw new Error('AI không trả về đúng định dạng, thử viết lại bài nhé.');
}

/** How people of each market really type searches (so keywords are local, not translated from English). */
const SEARCH_HABITS: Partial<Record<Lang, string>> = {
  es: 'Latin American Spanish as people type it in Mexico, Colombia, Argentina, Peru and Chile: "cómo quitar el fondo de una foto", "app para editar fotos gratis", "restaurar fotos viejas", "foto de perfil para WhatsApp"; questions with or without accents and "¿", "celular" more than "móvil".',
  pt: 'Brazilian Portuguese as people type it: "como tirar o fundo da foto", "app para editar foto grátis", "restaurar foto antiga", "foto de produto para vender".',
  vi: 'Vietnamese as people type it on Google, often without diacritics too: "xóa phông ảnh", "chỉnh ảnh đẹp bằng điện thoại", "phục hồi ảnh cũ".',
};

export type TopicRequest = {
  lang: Lang;
  /** A keyword group id, or 'random' for a mix. */
  direction: string;
  count: number;
  /** Optional free text from the admin (any language). */
  extra: string;
  model?: string;
};

/**
 * Topic ideas spread over the keyword groups (or all in one group), never repeating earlier ideas or articles,
 * favouring groups with few articles. Saved in blog_topics with their group, difficulty, priority and reason.
 */
export async function suggestTopics(req: TopicRequest) {
  const { topics: earlier, posts } = avoidList(req.lang);
  const cover = coverage(req.lang);
  const one = isClusterId(req.direction) ? req.direction : null;
  const thin = cover
    .filter((c) => c.cluster && c.published + c.drafts + c.suggested < 2)
    .map((c) => c.cluster)
    .join(', ');
  const ask = req.count + 3; // a few spare: repeats and over-full groups are dropped afterwards
  const system = `You are an SEO content strategist for CamIA, an AI photo editor whose main market is Latin America.\n${PRODUCT}`;
  const prompt = [
    `Suggest ${ask} blog article ideas written in ${languageName(req.lang)} (${req.lang}).`,
    `Keyword groups (use these ids):\n${BLOG_CLUSTERS.map((c) => `- ${c.id}: ${c.ai}`).join('\n')}`,
    one
      ? `All ideas must belong to the group "${one}", but each with a different angle (how-to, list, problem/solution, comparison, a specific audience or device, a specific case).`
      : `Spread the ideas over at least ${Math.min(ask, 7)} different groups, at most ${MAX_PER_CLUSTER} per group.${thin ? ` Favour these groups, which have few or no articles yet: ${thin}.` : ''}`,
    `Keywords and titles must use the words native speakers really type into Google, never literal translations from English. ${SEARCH_HABITS[req.lang] ?? ''}`,
    'Prefer specific long-tail searches a new site can rank for; every idea must fit naturally with a real CamIA feature; no clickbait.',
    req.extra ? `Extra direction from the editor (may be in any language): "${req.extra.slice(0, 300)}".` : '',
    earlier.length || posts.length
      ? `Do NOT suggest anything equal or close to these existing articles and earlier ideas:\n${[...posts.map((p) => `- ${p.title}`), ...earlier.map((t) => `- ${t.title} [${t.keyword}]`)].slice(0, 300).join('\n')}`
      : '',
    'For each idea: "title" (max 70 characters), "keyword" (the main search phrase), "cluster" (group id), "difficulty" (low/medium/high: realistic chance for a new small site to reach the top 10), "priority" (high/medium/low: search demand × fit with CamIA × how empty the group is), "reason" (max 20 words, in Vietnamese, why this idea is worth writing).',
    'Answer with JSON only: {"topics":[{"title":"...","keyword":"...","cluster":"...","difficulty":"...","priority":"...","reason":"..."}]}',
  ]
    .filter(Boolean)
    .join('\n\n');
  const r = await writeText(prompt, system, { model: req.model, timeoutMs: 150_000 });
  const data = parseJson<{ topics?: Record<string, unknown>[] }>(r.text);
  const items = (data.topics ?? []).map((t) => ({
    title: String(t.title ?? ''),
    keyword: String(t.keyword ?? ''),
    cluster: one ?? String(t.cluster ?? ''),
    difficulty: String(t.difficulty ?? ''),
    priority: String(t.priority ?? ''),
    reason: String(t.reason ?? ''),
  }));
  const saved = saveSuggestions(req.lang, items, one ? Infinity : MAX_PER_CLUSTER, req.count);
  return { topics: saved, model: r.model, source: r.source, usd: textCost(r.model, r.inTokens, r.outTokens) };
}

export type WrittenArticle = {
  title: string;
  slug: string;
  description: string;
  keywords: string;
  /** Markdown; pictures are still placeholders [[IMAGE 1]]… until they are drawn. */
  content: string;
  images: BlogImagePlan[];
  /** Keyword group: the one asked for, or the AI's choice. */
  cluster: string;
};

/** A whole SEO article about `topic`, in `lang`, with up to `images` picture placeholders. */
export async function writeArticle(req: BlogWriteRequest) {
  const words = BLOG_LENGTHS[req.length].words;
  const images = Math.max(0, Math.min(MAX_BLOG_IMAGES, req.images));
  const system = [
    `You are a senior SEO copywriter writing for the CamIA blog. You write natively in ${languageName(req.lang)}; for Spanish, use neutral Latin American Spanish (tú).`,
    PRODUCT,
    'Rules: be genuinely useful and accurate; never invent CamIA features, prices or statistics; no fake quotes; mention CamIA naturally (not every paragraph) with links to https://camia.app.',
  ].join('\n');
  const prompt = [
    `Write a blog article in ${languageName(req.lang)} (${req.lang}) about: "${req.topic.slice(0, 300)}".`,
    `Write the keywords and phrasing the way native speakers really search, not translated from English. ${SEARCH_HABITS[req.lang] ?? ''}`,
    req.keyword ? `Main SEO keyword: "${req.keyword.slice(0, 100)}" — use it in the title, the first paragraph, one H2 and naturally 3–5 times overall.` : 'Choose the best main SEO keyword for this topic yourself and use it in the title, the first paragraph and one H2.',
    `Length: about ${words} words. Tone: ${BLOG_TONES[req.tone].prompt}.`,
    'Structure (Markdown): a short engaging intro (no heading), then sections with ## H2 and ### H3 headings, step-by-step lists where useful, practical tips, a "## FAQ" section with 3–5 questions as ### headings, and a short conclusion with a call to action to try CamIA free at https://camia.app. Never use a # H1 (the title is shown separately).',
    images
      ? `Place exactly ${images} picture placeholder(s) on their own line where a picture helps, written as [[IMAGE 1]], [[IMAGE 2]]…; describe each picture in "images".`
      : 'Do not add pictures.',
    req.extra ? `Extra instructions from the editor (they take priority over the defaults above, may be in any language): "${req.extra.slice(0, 1000)}"` : '',
    'Answer with JSON only:',
    '{"cluster":"the keyword group id that fits best: ' + BLOG_CLUSTERS.map((c) => c.id).join('|') + '","title":"SEO title, max 60 characters, with the keyword","slug":"lowercase-ascii-words-with-hyphens","description":"meta description, 120–155 characters, with the keyword and a benefit","keywords":"5–8 comma-separated search phrases","content":"the Markdown article","images":[{"prompt":"detailed English description of a realistic, attractive photo for this spot, no text, no logos, no watermarks","alt":"short alt text in the article language"}]}',
  ]
    .filter(Boolean)
    .join('\n');
  const r = await writeText(prompt, system, { model: req.model });
  const data = parseJson<Partial<Record<keyof WrittenArticle, unknown>>>(r.text);
  const plans = Array.isArray(data.images) ? (data.images as { prompt?: unknown; alt?: unknown }[]) : [];
  const article: WrittenArticle = {
    title: String(data.title ?? '').trim().slice(0, 120),
    slug: String(data.slug ?? '').trim(),
    description: String(data.description ?? '').trim().slice(0, 300),
    keywords: String(data.keywords ?? '').trim().slice(0, 400),
    content: String(data.content ?? '').trim(),
    cluster: isClusterId(req.cluster) ? req.cluster : isClusterId(data.cluster) ? String(data.cluster) : '',
    images: plans
      .map((p) => ({ prompt: String(p.prompt ?? '').trim(), alt: String(p.alt ?? '').trim().slice(0, 150) }))
      .filter((p) => p.prompt)
      .slice(0, images),
  };
  if (!article.title || !article.content) throw new Error('AI trả về bài viết thiếu tiêu đề hoặc nội dung.');
  // An H1 in the body would compete with the page title.
  article.content = article.content.replace(/^# (.+)$/gm, '## $1');
  if (images && (article.images.length < images || !article.content.includes('[[IMAGE 1]]'))) {
    console.warn(`[blog] AI gave ${article.images.length}/${images} picture(s) for "${article.title}": filling in`);
    fillImages(article, images);
  }
  return { article, model: r.model, source: r.source, usd: textCost(r.model, r.inTokens, r.outTokens) };
}

/** Sections a picture can go before: the H2s, minus the FAQ and the conclusion. */
const pictureSpots = (content: string) =>
  [...content.matchAll(/^## (.+)$/gm)].filter((m) => !/faq|pregunta|pergunta|question|câu hỏi|conclus|kết luận|fazit|итог|まとめ|결론|总结/i.test(m[1]));

/**
 * When the model leaves out pictures (no descriptions, or no [[IMAGE n]] in the text), the missing ones are described
 * from the article's own headings and placed before its sections, so an article asked with pictures always gets them.
 */
function fillImages(article: WrittenArticle, count: number) {
  if (!count) return;
  const spots = pictureSpots(article.content);
  for (let i = article.images.length; i < count; i++) {
    const heading = spots[i % Math.max(1, spots.length)]?.[1].replace(/[*_`#]/g, '').trim() || article.title;
    article.images.push({
      prompt: `A realistic, attractive, bright photograph illustrating "${heading}" for a blog article titled "${article.title}". No text, no letters, no logos, no watermarks.`,
      alt: heading.slice(0, 150),
    });
  }
  // Pictures without a [[IMAGE n]] spot go before an H2 (spread over the article), or at the end.
  const missing = article.images.map((_, i) => i + 1).filter((n) => !article.content.includes(`[[IMAGE ${n}]]`));
  if (!missing.length) return;
  const heads = pictureSpots(article.content).map((m) => m.index!);
  const step = heads.length / (missing.length + 1);
  const inserts = missing.map((n, k) => ({ n, at: heads.length ? heads[Math.min(heads.length - 1, Math.floor(step * (k + 1)))] : -1 }));
  // From the end, so earlier positions stay valid.
  for (const { n, at } of inserts.sort((a, b) => b.at - a.at || b.n - a.n)) {
    article.content = at < 0 ? `${article.content}\n\n[[IMAGE ${n}]]` : `${article.content.slice(0, at)}[[IMAGE ${n}]]\n\n${article.content.slice(at)}`;
  }
}

/** One 16:9 picture for an article (JPEG/PNG base64). Flash by default: half the price of Pro, plenty for a blog. */
export async function drawBlogImage(prompt: string, model = 'gemini-3.1-flash-image') {
  const system =
    'You create photographs for a blog about photo editing. Realistic, bright, natural colors, professional composition. ' +
    'Never add any text, letters, captions, logos, watermarks or user-interface elements to the picture.';
  return editImage(null, prompt.slice(0, 1500), system, model, '16:9');
}
