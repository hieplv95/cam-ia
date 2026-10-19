/**
 * Production server for the VPS: serves the web app and the API routes built by `npx expo export -p web`.
 * Only Node is needed (no Express): expo-server comes with expo-router.
 *
 *   node --env-file=.env server.cjs        (PORT in .env, 3010 when not set)
 *
 * Put nginx in front for HTTPS; it must pass X-Real-IP (see deploy/nginx-camia.conf).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { Writable } = require('node:stream');
const { createRequestHandler } = require('expo-server/adapter/http');

const DIST = path.join(__dirname, 'dist');
const CLIENT = path.join(DIST, 'client');
const SERVER = path.join(DIST, 'server');
const PORT = Number(process.env.PORT) || 3010;
const HOST = process.env.HOST ?? '127.0.0.1';

if (!fs.existsSync(SERVER)) {
  console.error('dist/server is missing: run "npx expo export -p web" first.');
  process.exit(1);
}
process.env.NODE_ENV = 'production';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

/** A file of dist/client for this address, or null (then the Expo handler answers: pages and /api). */
function staticFile(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://x').pathname);
  } catch {
    return null;
  }
  if (pathname.startsWith('/api/')) return null;
  const file = path.normalize(path.join(CLIENT, pathname));
  if (!file.startsWith(CLIENT + path.sep)) return null;
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

const expo = createRequestHandler({ build: SERVER });

/* ---------- SEO: texts from the admin SEO tab, written into every page ---------- */

/** Pages search engines should list; the others (editor, export, admin…) need a photo or an account. */
const INDEXED = ['/', '/ai', '/presets', '/blog', '/privacy', '/terms', '/delete-account'];
const LANGS = ['es', 'pt', 'en', 'vi', 'fr', 'de', 'ru', 'zh', 'ja', 'ko'];
const OG_LOCALE = { es: 'es_LA', pt: 'pt_BR', en: 'en_US', vi: 'vi_VN', fr: 'fr_FR', de: 'de_DE', ru: 'ru_RU', zh: 'zh_CN', ja: 'ja_JP', ko: 'ko_KR' };
/** Changes saved on the admin page show up after at most this long. */
const SEO_TTL_MS = 30_000;
let seoCache = { at: 0, value: null };

async function seoSettings() {
  if (Date.now() - seoCache.at < SEO_TTL_MS) return seoCache.value;
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/seo`);
    if (r.ok) seoCache = { at: Date.now(), value: await r.json() };
  } catch (e) {
    console.error('[seo] settings unavailable', e.message);
  }
  return seoCache.value;
}

/** Search engines and link previews send no language and get the primary one; people get theirs when Cami has it. */
function pickLang(header, primary) {
  const wanted = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) };
    })
    .filter((x) => LANGS.includes(x.lang) && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return wanted[0]?.lang ?? primary;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The public address: EXPO_PUBLIC_SHARE_URL (e.g. https://camia.app), else what nginx forwarded. */
function originOf(req) {
  const fixed = (process.env.EXPO_PUBLIC_SHARE_URL ?? '').replace(/\/+$/, '');
  if (fixed) return fixed;
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  return `${proto}://${req.headers.host ?? 'localhost'}`;
}

/** Privacy policy, terms of use and account deletion page (es, en, pt, vi), shared with src/legal/LegalPage.tsx. */
const LEGAL = {
  '/privacy': require('./src/legal/privacy.json'),
  '/terms': require('./src/legal/terms.json'),
  '/delete-account': require('./src/legal/delete-account.json'),
};

/** A legal page as HTML: {contact} becomes a mailto link and https:// addresses become links. */
function legalHtml(docs, lang, nav) {
  const doc = docs[lang] ?? docs.en;
  const text = (t) =>
    esc(t)
      .replace(/https:\/\/[^\s)<]*[^\s).,<]/g, (url) => `<a href="${url}">${url}</a>`)
      .replace(/\{contact\}/g, `<a href="mailto:${esc(docs.contact)}">${esc(docs.contact)}</a>`);
  const sections = doc.sections
    .map(
      (sec) =>
        `<h2>${esc(sec.title)}</h2>` +
        (sec.bullets ? `<ul>${sec.bullets.map((b) => `<li>${text(b)}</li>`).join('')}</ul>` : '') +
        (sec.paragraphs ?? []).map((p) => `<p>${text(p)}</p>`).join(''),
    )
    .join('');
  return `<main><h1>${esc(doc.title)}</h1><p>${esc(doc.updated)}</p><p>${text(doc.intro)}</p>${sections}${nav}</main>`;
}

/** Title of the blog list page in each language. */
const BLOG_TITLE = {
  es: 'Blog de CamIA: trucos y guías para editar fotos con IA',
  pt: 'Blog da CamIA: dicas e guias para editar fotos com IA',
  en: 'CamIA Blog: tips and guides for editing photos with AI',
  vi: 'Blog CamIA: mẹo và hướng dẫn chỉnh ảnh bằng AI',
  fr: 'Blog CamIA : astuces et guides de retouche photo IA',
  de: 'CamIA-Blog: Tipps und Anleitungen zur KI-Fotobearbeitung',
  ru: 'Блог CamIA: советы и инструкции по обработке фото с ИИ',
  zh: 'CamIA 博客：AI 修图技巧与指南',
  ja: 'CamIA ブログ：AI 写真編集のコツとガイド',
  ko: 'CamIA 블로그: AI 사진 편집 팁과 가이드',
};

/* Published blog articles, by slug (cached like the SEO texts; null = no such article). */
const postCache = new Map();
async function blogPost(slug) {
  const hit = postCache.get(slug);
  if (hit && Date.now() - hit.at < SEO_TTL_MS) return hit.post;
  let post = null;
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/blog?slug=${encodeURIComponent(slug)}`);
    if (r.ok) post = (await r.json()).post;
  } catch (e) {
    console.error('[seo] blog unavailable', e.message);
  }
  if (postCache.size > 500) postCache.clear();
  postCache.set(slug, { at: Date.now(), post });
  return post;
}

const blogSlugOf = (pathname) => pathname.match(/^\/blog\/([a-z0-9-]{1,100})$/)?.[1] ?? null;

/* ---------- GEO: what AI assistants can read (they mostly don't run JavaScript) ---------- */

/** Same lists as src/seo.ts: answer/search bots are always welcome, training bots follow the admin switch. */
const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'DuckAssistBot'];
const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Bytespider'];

const FAQ_TITLE = {
  es: 'Preguntas frecuentes',
  pt: 'Perguntas frequentes',
  en: 'Frequently asked questions',
  vi: 'Câu hỏi thường gặp',
  fr: 'Questions fréquentes',
  de: 'Häufige Fragen',
  ru: 'Частые вопросы',
  zh: '常见问题',
  ja: 'よくある質問',
  ko: '자주 묻는 질문',
};

/** Latest published articles in a language (all languages while there are none), cached like the SEO texts. */
const listCache = new Map();
async function latestPosts(lang, limit = 12) {
  const key = `${lang}:${limit}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < SEO_TTL_MS) return hit.posts;
  let posts = [];
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/blog?lang=${lang}&limit=${limit}`);
    if (r.ok) posts = (await r.json()).posts ?? [];
  } catch (e) {
    console.error('[seo] blog list unavailable', e.message);
  }
  listCache.set(key, { at: Date.now(), posts });
  return posts;
}

const safeUrl = (url) => /^(https?:\/\/|\/)/.test(url);

/** **bold**, *italic*, `code` and [links](…) of one line, as escaped HTML. */
function inlineMd(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => (safeUrl(url) ? `<a href="${url}">${label}</a>` : label))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Blog Markdown → plain semantic HTML (same rules as the app's renderer, src/blog/Markdown.tsx). */
function mdToHtml(md) {
  const out = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) out.push(`<p>${inlineMd(para.join(' '))}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of String(md).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^\[\[IMAGE \d+\]\]$/i.test(line)) continue;
    let m = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (m) {
      flush();
      const n = Math.min(4, Math.max(2, m[1].length));
      out.push(`<h${n}>${inlineMd(m[2])}</h${n}>`);
      continue;
    }
    m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (m) {
      flush();
      if (safeUrl(m[2])) out.push(`<figure><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy"/>${m[1] ? `<figcaption>${esc(m[1])}</figcaption>` : ''}</figure>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      out.push('<hr/>');
      continue;
    }
    m = line.match(/^>\s?(.*)$/);
    if (m) {
      flush();
      out.push(`<blockquote>${inlineMd(m[1])}</blockquote>`);
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const tag = numbered ? 'ol' : 'ul';
      if (para.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? numbered)[1]);
      continue;
    }
    if (list) {
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join('\n');
}

/** Text without Markdown marks (for structured data). */
const plainMd = (s) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const FAQ_HEADING = /faq|preguntas frecuentes|perguntas frequentes|frequently asked|câu hỏi thường gặp|questions fréquentes|häufige fragen|часто задаваемые|частые вопросы|常见问题|よくある質問|자주 묻는/i;

/** The questions of an article's FAQ section (## FAQ, then ### question + answer paragraphs). */
function faqFromMarkdown(md) {
  const items = [];
  let inFaq = false;
  let cur = null;
  for (const raw of String(md).split('\n')) {
    const line = raw.trim();
    if (/^##\s/.test(line)) {
      if (cur) items.push(cur);
      cur = null;
      inFaq = FAQ_HEADING.test(line);
      continue;
    }
    if (!inFaq) continue;
    const q = line.match(/^###\s+(.+)$/);
    if (q) {
      if (cur) items.push(cur);
      cur = { q: plainMd(q[1]), a: [] };
      continue;
    }
    if (cur && line && !/^!\[/.test(line) && !/^\[\[IMAGE/i.test(line)) cur.a.push(plainMd(line));
  }
  if (cur) items.push(cur);
  return items.filter((i) => i.q && i.a.length).map((i) => ({ q: i.q, a: i.a.join(' ') }));
}

const faqJsonLd = (items) =>
  items.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      }
    : null;

const paragraphs = (text) =>
  String(text ?? '')
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

const faqHtml = (items, lang) =>
  items.length ? `<h2>${esc(FAQ_TITLE[lang] ?? FAQ_TITLE.en)}</h2>${items.map((i) => `<h3>${esc(i.q)}</h3><p>${esc(i.a)}</p>`).join('')}` : '';

const postListHtml = (posts, origin) =>
  posts.length
    ? `<ul>${posts.map((p) => `<li><a href="${esc(`${origin}/blog/${p.slug}`)}">${esc(p.title)}</a>${p.description ? ` — ${esc(p.description)}` : ''}</li>`).join('')}</ul>`
    : '';

/** /llms.txt: a Markdown summary of CamIA for AI assistants (llmstxt.org), in the main language. */
async function llmsTxt(origin) {
  const seo = await seoSettings();
  if (!seo) return '# CamIA\n';
  const lang = seo.primary;
  const t = seo.texts[lang];
  const geo = seo.geo ?? {};
  const posts = await latestPosts(lang, 30);
  const faq = geo.faq?.[lang] ?? [];
  const lines = [
    '# CamIA',
    '',
    `> ${t.description}`,
    '',
    geo.about?.[lang] ?? '',
    '',
    '## Pages',
    '',
    `- [CamIA](${origin}/): ${t.title}`,
    `- [AI tools](${origin}/ai)`,
    `- [Presets](${origin}/presets)`,
    `- [Blog](${origin}/blog): ${BLOG_TITLE[lang] ?? BLOG_TITLE.es}`,
  ];
  if (posts.length) lines.push('', '## Blog', '', ...posts.map((p) => `- [${p.title}](${origin}/blog/${p.slug})${p.description ? `: ${p.description}` : ''}`));
  if (faq.length) lines.push('', `## ${FAQ_TITLE[lang] ?? FAQ_TITLE.en}`, '', ...faq.flatMap((i) => [`### ${i.q}`, '', i.a, '']));
  const social = Object.values(geo.social ?? {}).filter(Boolean);
  if (social.length) lines.push('', '## Social', '', ...social.map((u) => `- ${u}`));
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** What a page says about itself: the site texts, or the article's own title, picture and language. */
async function pageMeta(seo, lang, pathname, origin) {
  const t = seo.texts[lang] ?? seo.texts[seo.primary];
  const base = {
    lang,
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    image: `${origin}/og-image.png`,
    imageSize: [1200, 630],
    type: 'website',
    indexed: INDEXED.includes(pathname),
    url: `${origin}${pathname}`,
    jsonLd: null,
    bodyHtml: '',
  };
  const geo = seo.geo ?? {};
  const nav = `<nav><a href="${origin}/">CamIA</a> · <a href="${origin}/ai">IA</a> · <a href="${origin}/blog">Blog</a></nav>`;

  if (pathname === '/') {
    const faq = geo.faq?.[lang] ?? [];
    const sameAs = Object.values(geo.social ?? {}).filter(Boolean);
    const posts = await latestPosts(lang, 6);
    return {
      ...base,
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'Organization', '@id': `${origin}/#org`, name: 'CamIA', url: `${origin}/`, logo: `${origin}/apple-touch-icon.png`, ...(sameAs.length && { sameAs }) },
        { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${origin}/#site`, name: 'CamIA', url: `${origin}/`, inLanguage: lang, publisher: { '@id': `${origin}/#org` } },
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'CamIA',
          url: `${origin}/`,
          description: geo.about?.[lang] || t.description,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Web, Android, iOS',
          browserRequirements: 'Requires JavaScript',
          inLanguage: lang,
          image: base.image,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@id': `${origin}/#org` },
        },
        faqJsonLd(faq),
      ].filter(Boolean),
      bodyHtml: `<main><h1>${esc(t.title)}</h1><p>${esc(t.description)}</p>${paragraphs(geo.about?.[lang])}${faqHtml(faq, lang)}${posts.length ? `<h2>Blog</h2>${postListHtml(posts, origin)}` : ''}${nav}</main>`,
    };
  }
  if (LEGAL[pathname]) {
    const docs = LEGAL[pathname];
    const doc = docs[lang] ?? docs.en;
    return { ...base, title: `${doc.title} · CamIA`, description: doc.intro.replace('{contact}', docs.contact).slice(0, 155), bodyHtml: legalHtml(docs, lang, nav) };
  }
  if (pathname === '/blog') {
    const title = BLOG_TITLE[lang] ?? BLOG_TITLE.es;
    const posts = await latestPosts(lang, 50);
    return { ...base, title, indexed: true, bodyHtml: `<main><h1>${esc(title)}</h1>${postListHtml(posts, origin)}${nav}</main>` };
  }
  const slug = blogSlugOf(pathname);
  if (!slug) return base.indexed ? { ...base, bodyHtml: `<main><h1>${esc(t.title)}</h1><p>${esc(t.description)}</p>${nav}</main>` } : base;
  const post = await blogPost(slug);
  if (!post) return { ...base, indexed: false };
  const image = post.cover ? `${origin}${post.cover}` : base.image;
  const articleFaq = faqFromMarkdown(post.content);
  const published = new Date(post.publishedAt ?? post.createdAt).toISOString();
  return {
    bodyHtml:
      `<main><article><nav><a href="${origin}/">CamIA</a> › <a href="${origin}/blog">Blog</a></nav><h1>${esc(post.title)}</h1>` +
      `<p><time datetime="${published}">${published.slice(0, 10)}</time></p>${post.cover ? `<img src="${esc(image)}" alt="${esc(post.title)}"/>` : ''}` +
      `${mdToHtml(post.content)}</article>${nav}</main>`,
    lang: post.lang,
    title: `${post.title} | CamIA`,
    description: post.description || t.description,
    keywords: post.keywords,
    image,
    imageSize: post.cover ? null : base.imageSize,
    type: 'article',
    indexed: true,
    url: base.url,
    published: post.publishedAt,
    modified: post.updatedAt,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CamIA', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` },
          { '@type': 'ListItem', position: 3, name: post.title, item: base.url },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        image: [image],
        inLanguage: post.lang,
        datePublished: new Date(post.publishedAt ?? post.createdAt).toISOString(),
        dateModified: new Date(post.updatedAt).toISOString(),
        mainEntityOfPage: base.url,
        author: { '@type': 'Organization', name: 'CamIA', url: origin },
        publisher: { '@type': 'Organization', name: 'CamIA', logo: { '@type': 'ImageObject', url: `${origin}/apple-touch-icon.png` } },
      },
      faqJsonLd(articleFaq),
    ].filter(Boolean),
  };
}

function withSeo(html, seo, m) {
  const tags = [
    `<meta name="description" content="${esc(m.description)}"/>`,
    m.keywords ? `<meta name="keywords" content="${esc(m.keywords)}"/>` : '',
    `<meta name="robots" content="${m.indexed ? 'index, follow, max-image-preview:large' : 'noindex, follow'}"/>`,
    seo.verification ? `<meta name="google-site-verification" content="${esc(seo.verification)}"/>` : '',
    m.indexed ? `<link rel="canonical" href="${esc(m.url)}"/>` : '',
    m.indexed ? `<link rel="alternate" type="application/rss+xml" title="CamIA Blog" href="${esc(m.url.replace(/^(https?:\/\/[^/]+).*$/, '$1'))}/blog/rss.xml"/>` : '',
    `<meta name="theme-color" content="#FAF6F0"/>`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>`,
    `<meta property="og:type" content="${m.type}"/>`,
    `<meta property="og:site_name" content="CamIA"/>`,
    `<meta property="og:title" content="${esc(m.title)}"/>`,
    `<meta property="og:description" content="${esc(m.description)}"/>`,
    `<meta property="og:url" content="${esc(m.url)}"/>`,
    `<meta property="og:image" content="${esc(m.image)}"/>`,
    m.imageSize ? `<meta property="og:image:width" content="${m.imageSize[0]}"/><meta property="og:image:height" content="${m.imageSize[1]}"/>` : '',
    `<meta property="og:locale" content="${OG_LOCALE[m.lang] ?? 'es_LA'}"/>`,
    m.published ? `<meta property="article:published_time" content="${new Date(m.published).toISOString()}"/>` : '',
    m.modified ? `<meta property="article:modified_time" content="${new Date(m.modified).toISOString()}"/>` : '',
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${esc(m.title)}"/>`,
    `<meta name="twitter:description" content="${esc(m.description)}"/>`,
    `<meta name="twitter:image" content="${esc(m.image)}"/>`,
    // "<" is escaped so the article text can never close the script tag.
    m.jsonLd ? `<script type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].join('');
  return html
    .replace(/<html[^>]*>/, `<html lang="${m.lang}">`)
    .replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title data-rh="true">${esc(m.title)}</title>`)
    .replace('</head>', `${tags}</head>`)
    // A plain copy of the page for crawlers and AI assistants that don't run JavaScript (same content the app shows).
    .replace('</body>', m.bodyHtml ? `<noscript>${m.bodyHtml}</noscript></body>` : '</body>');
}

/** Collects what the Expo handler writes, so a page can be edited before it is sent. */
function captureResponse() {
  const chunks = [];
  const out = new Writable({
    write(chunk, _enc, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  });
  out.statusCode = 200;
  out.statusMessage = '';
  out.headers = new Headers();
  out.setHeaders = (h) => h.forEach((v, k) => out.headers.append(k, v));
  out.appendHeader = (k, v) => out.headers.append(k, v);
  out.body = () => Buffer.concat(chunks);
  return out;
}

async function servePage(req, res, pathname) {
  const page = captureResponse();
  await expo(req, page, (error) => {
    throw error;
  });
  let body = page.body();
  const type = page.headers.get('content-type') ?? '';
  const headers = Object.fromEntries(page.headers.entries());
  if (type.includes('text/html')) {
    const seo = await seoSettings();
    if (seo) {
      const meta = await pageMeta(seo, pickLang(req.headers['accept-language'], seo.primary), pathname, originOf(req));
      body = Buffer.from(withSeo(body.toString('utf8'), seo, meta));
      headers['vary'] = 'Accept-Language';
    }
  }
  delete headers['content-length'];
  headers['content-length'] = String(body.length);
  res.writeHead(page.statusCode, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/** robots.txt: search engines and AI answer bots read the public pages; AI training bots follow the admin switch. */
async function robotsTxt(origin) {
  const seo = await seoSettings();
  const allowTraining = seo?.geo?.allowTraining !== false;
  // Blog pictures live under /api/, which is otherwise closed: let image search see them.
  const rules = ['Allow: /', 'Allow: /api/blog/image/', 'Disallow: /admin', 'Disallow: /api/'];
  return [
    'User-agent: *',
    ...rules,
    '',
    '# AI assistants that answer questions and cite their sources',
    ...AI_SEARCH_BOTS.map((b) => `User-agent: ${b}`),
    ...rules,
    '',
    `# AI model training (${allowTraining ? 'allowed' : 'not allowed'} in the admin SEO tab)`,
    ...AI_TRAINING_BOTS.map((b) => `User-agent: ${b}`),
    ...(allowTraining ? rules : ['Disallow: /']),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

async function apiJson(pathAndQuery) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}${pathAndQuery}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function sitemapXml(origin) {
  const pages = INDEXED.map((p) => `  <url><loc>${esc(origin + p)}</loc><changefreq>weekly</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>`);
  const posts = ((await apiJson('/api/blog?sitemap=1'))?.posts ?? []).map(
    (p) =>
      `  <url><loc>${esc(`${origin}/blog/${p.slug}`)}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod><priority>0.6</priority>` +
      (p.cover ? `<image:image><image:loc>${esc(`${origin}/api/blog/image/${p.cover}`)}</image:loc></image:image>` : '') +
      '</url>',
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...pages, ...posts].join('\n')}
</urlset>
`;
}

/** The latest articles (every language) for feed readers and aggregators. */
async function rssXml(origin) {
  const posts = (await apiJson('/api/blog?limit=30'))?.posts ?? [];
  const items = posts.map(
    (p) =>
      `  <item><title>${esc(p.title)}</title><link>${esc(`${origin}/blog/${p.slug}`)}</link><guid>${esc(`${origin}/blog/${p.slug}`)}</guid>` +
      `<pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>CamIA Blog</title><link>${esc(origin)}/blog</link><description>CamIA</description>
${items.join('\n')}
</channel></rss>
`;
}

const FEEDS = { '/robots.txt': 'text/plain', '/sitemap.xml': 'application/xml', '/blog/rss.xml': 'application/rss+xml', '/llms.txt': 'text/plain' };
const FEED_MAKERS = { '/robots.txt': robotsTxt, '/sitemap.xml': sitemapXml, '/blog/rss.xml': rssXml, '/llms.txt': llmsTxt };

const server = http.createServer((req, res) => {
  const pathname = (() => {
    try {
      return new URL(req.url, 'http://x').pathname.replace(/\/+$/, '') || '/';
    } catch {
      return '/';
    }
  })();
  if ((req.method === 'GET' || req.method === 'HEAD') && FEEDS[pathname]) {
    const origin = originOf(req);
    const make = () => FEED_MAKERS[pathname](origin);
    make()
      .then((text) => {
        res.writeHead(200, { 'Content-Type': `${FEEDS[pathname]}; charset=utf-8`, 'Cache-Control': 'public, max-age=600' });
        res.end(req.method === 'HEAD' ? undefined : text);
      })
      .catch(() => {
        res.writeHead(500);
        res.end();
      });
    return;
  }
  const file = req.method === 'GET' || req.method === 'HEAD' ? staticFile(req.url) : null;
  if (file) {
    // Bundles and assets have a content hash in their name, and CanvasKit a version in its URL (index.web.js):
    // cache them for a year. Other files for an hour.
    const hashed = req.url.startsWith('/_expo/static/') || req.url.startsWith('/assets/') || req.url.startsWith('/canvaskit.wasm?v=');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
    return;
  }
  const fail = (error) => {
    console.error('[server]', req.method, req.url, error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  };
  // Pages go through servePage to get the SEO tags; the API answers directly (it may stream big images).
  if ((req.method === 'GET' || req.method === 'HEAD') && !pathname.startsWith('/api/')) {
    servePage(req, res, pathname).catch(fail);
    return;
  }
  expo(req, res, fail);
});

server.listen(PORT, HOST, () => console.log(`Cami listening on http://${HOST}:${PORT}`));
