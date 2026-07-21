import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const artifact = resolve(root, 'artifacts', `contextfill-companion-v${packageJson.version}.tgz`);

function run(command, args, options = {}, expectedCode = 0) {
  return new Promise((resolvePromise, reject) => {
    const { input, ...spawnOptions } = options;
    const child = spawn(command, args, {
      ...spawnOptions,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === expectedCode) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stdout}${stderr}`));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolvePromise, reject) =>
    probe.close((error) => (error ? reject(error) : resolvePromise())),
  );
  if (!port) throw new Error('Could not reserve a loopback port.');
  return port;
}

async function smokeStart(bin, runtime) {
  const port = await freePort();
  const child = spawn(bin, [], {
    cwd: runtime,
    env: {
      ...process.env,
      CONTEXTFILL_SERVICE_PORT: String(port),
      CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: `http://localhost:${port}`,
      CONTEXTFILL_EXTENSION_ID: 'a'.repeat(32),
      CONTEXTFILL_PAIRING_RESET: '0',
      CONTEXTFILL_GOOGLE_CLIENT_ID: '',
      CONTEXTFILL_GOOGLE_CLIENT_SECRET: '',
      CONTEXTFILL_MICROSOFT_CLIENT_ID: '',
      OPENAI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const ready = new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Installed companion did not start.\n${output}`)),
      10_000,
    );
    const collect = (chunk) => {
      output += chunk;
      if (output.includes(`listening on http://127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        resolvePromise();
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      if (!output.includes(`listening on http://127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        reject(new Error(`Installed companion exited ${code}.\n${output}`));
      }
    });
  });
  try {
    await ready;
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await health.json();
    if (!health.ok || body.ok !== true) {
      throw new Error(`Installed companion health check failed.\n${JSON.stringify(body)}`);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolvePromise) => child.once('exit', resolvePromise));
    }
  }
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
  const doctorMissing = await run(bin, ['--doctor'], { cwd: runtime }, 1);
  if (!doctorMissing.stdout.includes('Result: not ready')) {
    throw new Error('Installed companion doctor did not report missing provider setup.');
  }
  const clientId = '11111111-2222-4333-8444-555555555555';
  const setup = await run(bin, ['--setup', 'outlook'], {
    cwd: runtime,
    input: `${clientId}\n`,
  });
  if (!setup.stdout.includes('Result: ready for outlook') || setup.stdout.includes(clientId)) {
    throw new Error('Installed companion guided setup did not safely configure Outlook.');
  }
  const savedEnvironment = await readFile(resolve(runtime, '.env'), 'utf8');
  if (!savedEnvironment.includes(`CONTEXTFILL_MICROSOFT_CLIENT_ID=${clientId}`)) {
    throw new Error('Installed companion guided setup did not persist the Outlook client ID.');
  }
  const googleClientId = '123456789-contextfill.apps.googleusercontent.com';
  const googleClientSecret = 'fake-google-client-secret';
  const googleCredentials = resolve(runtime, 'google-client.json');
  await writeFile(
    googleCredentials,
    JSON.stringify({
      web: {
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uris: ['http://localhost:4318/mail/oauth/gmail/callback'],
      },
    }),
    { mode: 0o600 },
  );
  const gmailSetup = await run(bin, ['--setup', 'gmail', '--credentials', googleCredentials], {
    cwd: runtime,
  });
  if (
    !gmailSetup.stdout.includes('Result: ready for gmail, outlook') ||
    gmailSetup.stdout.includes(googleClientId) ||
    gmailSetup.stdout.includes(googleClientSecret)
  ) {
    throw new Error('Installed companion guided setup did not safely configure Gmail.');
  }
  const doctorReady = await run(bin, ['--doctor'], { cwd: runtime });
  if (!doctorReady.stdout.includes('Outlook: ready') || doctorReady.stdout.includes(clientId)) {
    throw new Error('Installed companion doctor did not safely report provider readiness.');
  }
  await smokeStart(bin, runtime);
  console.log(
    'Installed companion package passed help/init/Gmail+Outlook-setup/doctor/no-overwrite/startup/health smoke checks.',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
