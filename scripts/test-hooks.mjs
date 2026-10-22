// Lets Node run the app's TypeScript modules in tests (`npm test`): resolves extensionless imports ('./types')
// and the '@/…' alias the way Metro does. Node strips the types itself (Node ≥ 22.18).
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isFile = (p) => existsSync(p) && statSync(p).isFile();

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith('@/')) base = path.join(root, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (base) {
      for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts']) {
        if (isFile(base + ext)) return next(pathToFileURL(base + ext).href, context);
      }
    }
    return next(specifier, context);
  },
});
