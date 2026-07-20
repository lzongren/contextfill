import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const extension = resolve(root, 'dist/extension');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

if (
  typeof packageJson.version !== 'string' ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(packageJson.version)
) {
  throw new Error('package.json must contain a valid semantic version');
}

const output = resolve(artifacts, `contextfill-extension-v${packageJson.version}.zip`);

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
