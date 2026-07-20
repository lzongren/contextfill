import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const extension = resolve(root, 'dist/extension');
const output = resolve(artifacts, 'contextfill-extension-v0.1.0.zip');

await mkdir(artifacts, { recursive: true });
await rm(output, { force: true });

await new Promise((resolvePromise, reject) => {
  const child = spawn('zip', ['-qr', output, '.'], { cwd: extension, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', (code) =>
    code === 0 ? resolvePromise() : reject(new Error(`zip exited ${code}`)),
  );
});

console.log(`Packaged extension at ${output}`);
