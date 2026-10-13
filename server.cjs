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
const INDEXED = ['/', '/ai', '/presets', '/blog'];
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
  };
  if (pathname === '/blog') return { ...base, title: BLOG_TITLE[lang] ?? BLOG_TITLE.es, indexed: true };
  const slug = blogSlugOf(pathname);
  if (!slug) return base;
  const post = await blogPost(slug);
  if (!post) return { ...base, indexed: false };
  const image = post.cover ? `${origin}${post.cover}` : base.image;
  return {
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
    ],
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
    .replace('</head>', `${tags}</head>`);
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

function robotsTxt(origin) {
  // Blog pictures live under /api/, which is otherwise closed: let Google Images see them.
  return `User-agent: *
Allow: /
Allow: /api/blog/image/
Disallow: /admin
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`;
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
    (p) => `  <url><loc>${esc(`${origin}/blog/${p.slug}`)}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod><priority>0.6</priority></url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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

const FEEDS = { '/robots.txt': 'text/plain', '/sitemap.xml': 'application/xml', '/blog/rss.xml': 'application/rss+xml' };

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
    const make = pathname === '/robots.txt' ? async () => robotsTxt(origin) : pathname === '/sitemap.xml' ? () => sitemapXml(origin) : () => rssXml(origin);
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
    // Bundles and assets have a content hash in their name: cache them for a year. Other files for an hour.
    const hashed = req.url.startsWith('/_expo/static/') || req.url.startsWith('/assets/');
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
