import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const staging = resolve(root, 'dist/companion-package');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

if (
  typeof packageJson.version !== 'string' ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(packageJson.version)
) {
  throw new Error('package.json must contain a valid semantic version');
}

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await mkdir(artifacts, { recursive: true });

await Promise.all([
  copyFile(resolve(root, 'dist/local-service/server.js'), resolve(staging, 'server.js')),
  copyFile(resolve(root, 'dist/local-service/server.js.map'), resolve(staging, 'server.js.map')),
  copyFile(resolve(root, '.env.example'), resolve(staging, '.env.example')),
  copyFile(resolve(root, 'LICENSE'), resolve(staging, 'LICENSE')),
]);
const packageReadme = await readFile(resolve(root, 'apps/local-service/PACKAGE_README.md'), 'utf8');
await writeFile(
  resolve(staging, 'README.md'),
  packageReadme.replaceAll('VERSION', packageJson.version),
);

await writeFile(
  resolve(staging, 'package.json'),
  `${JSON.stringify(
    {
      name: 'contextfill-companion',
      version: packageJson.version,
      description: 'Local OAuth, keychain, and mailbox service for the ContextFill extension.',
      type: 'module',
      bin: { 'contextfill-service': './server.js' },
      engines: { node: '>=20' },
      dependencies: { '@napi-rs/keyring': packageJson.dependencies['@napi-rs/keyring'] },
      license: 'MIT',
      repository: { type: 'git', url: 'https://github.com/lzongren/contextfill.git' },
    },
    null,
    2,
  )}\n`,
);

const packedName = `contextfill-companion-${packageJson.version}.tgz`;
await rm(resolve(artifacts, packedName), { force: true });
await new Promise((resolvePromise, reject) => {
  const child = spawn('npm', ['pack', '--pack-destination', artifacts], {
    cwd: staging,
    env: { ...process.env, npm_config_cache: resolve(root, 'dist/npm-cache') },
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('exit', (code) =>
    code === 0 ? resolvePromise() : reject(new Error(`npm pack exited ${code}`)),
  );
});

const output = resolve(artifacts, `contextfill-companion-v${packageJson.version}.tgz`);
await rm(output, { force: true });
await rename(resolve(artifacts, packedName), output);
console.log(`Packaged companion service at ${output}`);
