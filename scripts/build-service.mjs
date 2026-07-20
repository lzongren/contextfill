import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const outdir = resolve(root, 'dist/local-service');
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [resolve(root, 'apps/local-service/src/server.ts')],
  outfile: resolve(outdir, 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  sourcemap: true,
  external: ['@napi-rs/keyring'],
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __contextfillCreateRequire } from 'node:module';\nconst require = __contextfillCreateRequire(import.meta.url);",
  },
});

console.log(`Built local service at ${outdir}`);
