import { stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectMailboxSetup } from './mailbox.js';

export const environmentTemplate = `# Optional. ContextFill works without an OpenAI key.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
CONTEXTFILL_SERVICE_PORT=4318

# Set to 1 for one service start to clear a lost pairing and print a new code.
CONTEXTFILL_PAIRING_RESET=0

# Register the provider callback URLs documented in MAILBOX_INTEGRATION.md, then run
# contextfill-service --doctor (or npm run service -- --doctor from source).
CONTEXTFILL_OAUTH_REDIRECT_ORIGIN=http://localhost:4318

# Gmail API OAuth web client. ContextFill requests gmail.readonly.
CONTEXTFILL_GOOGLE_CLIENT_ID=
CONTEXTFILL_GOOGLE_CLIENT_SECRET=

# Microsoft Entra public client. common supports personal plus work/school accounts.
CONTEXTFILL_MICROSOFT_CLIENT_ID=
CONTEXTFILL_MICROSOFT_TENANT=common
`;

export const helpText = `ContextFill companion service

Usage:
  contextfill-service --init   create a private .env template in the current directory
  contextfill-service --doctor validate mailbox OAuth readiness without printing secrets
  contextfill-service          start the loopback service on 127.0.0.1:4318
  contextfill-service --help   show this help

Configure a Gmail or Microsoft OAuth application in .env before connecting a real mailbox.
The service prints a one-time code used to pair the ContextFill extension.`;

export async function initializeConfig(directory = process.cwd()): Promise<string> {
  const output = resolve(directory, '.env');
  await writeFile(output, environmentTemplate, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return output;
}

export type DoctorReport = {
  ok: boolean;
  text: string;
};

export async function inspectCompanionReadiness(
  directory = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<DoctorReport> {
  const lines = ['ContextFill mailbox OAuth doctor', ''];
  let privateConfig = true;
  const configPath = resolve(directory, '.env');
  try {
    const details = await stat(configPath);
    if (!details.isFile()) {
      privateConfig = false;
      lines.push('.env: FAIL (configuration path is not a regular file)');
    } else if (process.platform !== 'win32' && (details.mode & 0o077) !== 0) {
      privateConfig = false;
      lines.push('.env permissions: FAIL (remove group/other access; expected mode 600)');
    } else {
      lines.push('.env permissions: ready (owner-only)');
    }
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      lines.push('.env: not found (process environment variables are still supported)');
    } else {
      privateConfig = false;
      lines.push('.env: FAIL (could not inspect configuration file)');
    }
  }

  let setup;
  try {
    setup = inspectMailboxSetup(environment);
  } catch (error) {
    lines.push(
      `Loopback configuration: FAIL (${error instanceof Error ? error.message : 'invalid configuration'})`,
      '',
      'Result: not ready. Correct the loopback settings and run --doctor again.',
    );
    return { ok: false, text: lines.join('\n') };
  }

  lines.push(
    `Service endpoint: http://127.0.0.1:${setup.servicePort}`,
    `OAuth callback origin: ${setup.redirectOrigin}`,
    '',
  );
  for (const provider of setup.providers) {
    const label = provider.provider === 'gmail' ? 'Gmail' : 'Outlook';
    lines.push(
      `${label}: ${provider.configured ? 'ready' : `not configured (missing ${provider.missing.join(', ')})`}`,
      `  Registration: ${provider.registrationType}`,
      `  Callback: ${provider.redirectUri}`,
      `  Scopes: ${provider.scopes.join(' ')}`,
    );
  }
  const configured = setup.providers.filter((provider) => provider.configured);
  const ok = privateConfig && configured.length > 0;
  lines.push(
    '',
    ok
      ? `Result: ready for ${configured.map((provider) => provider.provider).join(', ')}. Start contextfill-service, pair the extension, and connect.`
      : 'Result: not ready. Configure at least one provider and run --doctor again.',
  );
  return { ok, text: lines.join('\n') };
}
