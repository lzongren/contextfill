import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const artifact = resolve(root, 'artifacts', `contextfill-companion-v${packageJson.version}.tgz`);

function run(command, args, options = {}, expectedCode = 0) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === expectedCode) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stdout}${stderr}`));
    });
  });
}

const directory = await mkdtemp(join(tmpdir(), 'contextfill-companion-smoke-'));
try {
  await run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--prefix',
    directory,
    artifact,
  ]);
  const bin = resolve(directory, 'node_modules/.bin/contextfill-service');
  const help = await run(bin, ['--help']);
  if (!help.stdout.includes('ContextFill companion service')) {
    throw new Error('Installed companion did not print its help text.');
  }

  const runtime = resolve(directory, 'runtime');
  await mkdir(runtime);
  await run(bin, ['--init'], { cwd: runtime });
  const environment = await readFile(resolve(runtime, '.env'), 'utf8');
  if (!environment.includes('CONTEXTFILL_GOOGLE_CLIENT_ID=')) {
    throw new Error('Installed companion did not create the provider configuration template.');
  }
  if (
    process.platform !== 'win32' &&
    ((await stat(resolve(runtime, '.env'))).mode & 0o777) !== 0o600
  ) {
    throw new Error('Installed companion configuration is not owner-only.');
  }
  await run(bin, ['--init'], { cwd: runtime }, 1);
  console.log('Installed companion package passed help/init/no-overwrite smoke checks.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
