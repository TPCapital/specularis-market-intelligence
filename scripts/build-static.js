import { cp, mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');

const skip = new Set([
  '.git',
  '.vercel',
  'node_modules',
  'dist',
  'api',
  'src',
  'scripts',
]);

const skipFiles = new Set([
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'vercel.json',
  'README.md',
  'CHANGELOG.md',
  'FIXLOG.md',
]);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  const name = entry.name;
  const from = path.join(root, name);
  const to = path.join(out, name);

  if (entry.isDirectory()) {
    if (!skip.has(name)) {
      await cp(from, to, { recursive: true });
    }
    continue;
  }

  if (entry.isFile() && !skipFiles.has(name)) {
    await copyFile(from, to);
  }
}

// Vercel serves files inside public/ at site root in most frameworks.
// This static dashboard also supports direct root-level assets.
if (await exists(path.join(root, 'public'))) {
  await cp(path.join(root, 'public'), out, { recursive: true });
}

console.log('Static dashboard built to dist/');
