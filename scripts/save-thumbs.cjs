/**
 * Saves the ready-made preset and AI tool pictures drawn by src/develop/renderThumbs.tsx (development only).
 * 1. `node scripts/save-thumbs.cjs` (listens on http://localhost:8099).
 * 2. Open the app with `npx expo start --web --port 8095` and run `await camiRenderThumbs()` in the browser console.
 * The JPEGs land in assets/images/presets/ and assets/images/illustrations/; stop this script with Ctrl+C.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const allowed = ['assets/images/presets', 'assets/images/illustrations'];

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8095');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') return res.end();
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { dir, files } = JSON.parse(body);
        if (!allowed.includes(dir)) throw new Error(`folder not allowed: ${dir}`);
        fs.mkdirSync(path.join(root, dir), { recursive: true });
        for (const [name, uri] of Object.entries(files)) {
          if (!/^[a-z0-9-]+\.jpg$/i.test(name)) throw new Error(`bad file name: ${name}`);
          fs.writeFileSync(path.join(root, dir, name), Buffer.from(uri.split(',')[1], 'base64'));
        }
        console.log(`${Object.keys(files).length} pictures → ${dir}`);
        res.end('ok');
      } catch (e) {
        res.statusCode = 400;
        res.end(String(e));
      }
    });
  })
  .listen(8099, () => console.log('Waiting for camiRenderThumbs() on http://localhost:8099 …'));
