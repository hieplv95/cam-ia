/**
 * Production server for the VPS: serves the web app and the API routes built by `npx expo export -p web`.
 * Only Node is needed (no Express): expo-server comes with expo-router.
 *
 *   node --env-file=.env server.cjs        (PORT defaults to 3010)
 *
 * Put nginx in front for HTTPS; it must pass X-Real-IP (see deploy/nginx-camia.conf).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/http');

const DIST = path.join(__dirname, 'dist');
const CLIENT = path.join(DIST, 'client');
const SERVER = path.join(DIST, 'server');
const PORT = Number(process.env.PORT ?? 3010);
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

const server = http.createServer((req, res) => {
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
  expo(req, res, (error) => {
    console.error('[server]', req.method, req.url, error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  });
});

server.listen(PORT, HOST, () => console.log(`Cami listening on http://${HOST}:${PORT}`));
