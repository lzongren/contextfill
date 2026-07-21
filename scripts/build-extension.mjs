import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const extensionRoot = resolve(root, 'apps/extension');
const outdir = resolve(root, 'dist/extension');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const entries = [
  ['src/popup.ts', 'popup.js'],
  ['src/content.ts', 'content.js'],
  ['src/background.ts', 'background.js'],
  ['src/options.ts', 'options.js'],
  ['src/capsule-content.ts', 'capsule-content.js'],
];

for (const [entry, outfile] of entries) {
  await build({
    entryPoints: [resolve(extensionRoot, entry)],
    outfile: resolve(outdir, outfile),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome114'],
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });
}

await cp(resolve(extensionRoot, 'popup.html'), resolve(outdir, 'popup.html'));
await cp(resolve(extensionRoot, 'popup.css'), resolve(outdir, 'popup.css'));
await cp(resolve(extensionRoot, 'options.html'), resolve(outdir, 'options.html'));
await cp(resolve(extensionRoot, 'options.css'), resolve(outdir, 'options.css'));

const manifest = JSON.parse(await readFile(resolve(extensionRoot, 'manifest.json'), 'utf8'));
await writeFile(resolve(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built unpacked extension at ${outdir}`);
