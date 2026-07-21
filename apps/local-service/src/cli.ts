import { chmod, lstat, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
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

# Gmail API OAuth web client. Prefer --setup gmail --credentials <json> so the downloaded
# secret is validated and imported without terminal echo. ContextFill requests gmail.readonly.
CONTEXTFILL_GOOGLE_CLIENT_ID=
CONTEXTFILL_GOOGLE_CLIENT_SECRET=

# Microsoft Entra public client. Creating the registration requires an Entra tenant role;
# a standalone personal Outlook.com account cannot create it. Run the guided setup first.
# common lets the finished app accept personal plus work/school accounts.
CONTEXTFILL_MICROSOFT_CLIENT_ID=
CONTEXTFILL_MICROSOFT_TENANT=common
`;

export const helpText = `ContextFill companion service

Usage:
  contextfill-service --init   create a private .env template in the current directory
  contextfill-service --setup outlook [--tenant common]
                               guide Microsoft app registration and save its public client ID
  contextfill-service --setup gmail [--credentials client_secret.json]
                               guide Google setup or privately import its downloaded web client
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

const microsoftClientIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const microsoftTenantPattern =
  /^(?:common|consumers|organizations|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)$/iu;
const googleCredentialsSchema = z
  .object({
    web: z
      .object({
        client_id: z
          .string()
          .min(20)
          .max(512)
          .regex(/^[a-z0-9._-]+\.apps\.googleusercontent\.com$/iu),
        client_secret: z
          .string()
          .min(8)
          .max(512)
          .refine(
            (value) =>
              Array.from(value).every((character) => {
                const code = character.codePointAt(0) ?? 0;
                return code >= 32 && code !== 127;
              }),
            'Client secret contains control characters.',
          ),
        redirect_uris: z.array(z.string().url()).min(1).max(20),
      })
      .passthrough(),
  })
  .passthrough();

function replaceEnvironmentValue(contents: string, key: string, value: string): string {
  const assignment = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`, 'u');
  const lines = contents.split('\n');
  let replaced = false;
  const updated = lines.filter((line) => {
    if (!assignment.test(line)) return true;
    if (replaced) return false;
    replaced = true;
    return true;
  });
  if (replaced) {
    const index = updated.findIndex((line) => assignment.test(line));
    updated[index] = `${key}=${value}`;
  } else {
    if (updated.at(-1) !== '') updated.push('');
    updated.push(`${key}=${value}`);
  }
  return updated.join('\n');
}

async function readPrivateConfiguration(directory: string): Promise<{
  contents: string;
  output: string;
}> {
  const output = resolve(directory, '.env');
  try {
    const details = await lstat(output);
    if (!details.isFile() || details.isSymbolicLink()) {
      throw new Error('.env must be a regular file owned by the current user.');
    }
    const contents = await readFile(output, 'utf8');
    if (process.platform !== 'win32') await chmod(output, 0o600);
    return { contents, output };
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') throw error;
    return { contents: environmentTemplate, output };
  }
}

async function writePrivateConfiguration(output: string, contents: string): Promise<void> {
  await writeFile(output, contents, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') await chmod(output, 0o600);
}

export function gmailSetupInstructions(environment: NodeJS.ProcessEnv = process.env): string {
  const setup = inspectMailboxSetup(environment);
  const gmail = setup.providers.find((provider) => provider.provider === 'gmail');
  if (!gmail) throw new Error('Gmail setup metadata is unavailable.');
  return [
    'ContextFill guided Gmail setup',
    '',
    '1. In a Google Cloud project, enable the Gmail API and configure the OAuth consent screen.',
    `2. Add the read-only scope: ${gmail.scopes.join(' ')}`,
    '3. Create an OAuth client of type Web application with this exact redirect URI:',
    `   ${gmail.redirectUri}`,
    '4. Download the OAuth client JSON, then import it without copying its secret:',
    '   contextfill-service --setup gmail --credentials /path/to/client_secret.json',
    '',
    'The import validates the callback, saves the client ID and secret to owner-only .env,',
    'and never prints either credential. Delete the downloaded JSON after a successful import.',
  ].join('\n');
}

export function outlookSetupInstructions(environment: NodeJS.ProcessEnv = process.env): string {
  const setup = inspectMailboxSetup(environment);
  const outlook = setup.providers.find((provider) => provider.provider === 'outlook');
  if (!outlook) throw new Error('Outlook setup metadata is unavailable.');
  return [
    'ContextFill guided Outlook setup',
    '',
    'Prerequisite: sign in with a work/school account in an Entra tenant where you can',
    'register applications (at least the Application Developer role). A standalone',
    'personal Outlook.com account can use the finished connector, but cannot create',
    'the registration. Create an Azure account/tenant or ask a tenant administrator.',
    '',
    '1. Open Microsoft Entra app registrations:',
    '   https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    '2. Create a registration for the account types you intend to use.',
    '3. Under Authentication, add a Mobile and desktop applications platform with:',
    `   ${outlook.redirectUri}`,
    '4. Enable public client flows.',
    `5. Add delegated permissions: ${outlook.scopes.filter((scope) => !['openid', 'profile', 'email', 'offline_access'].includes(scope)).join(' ')}`,
    '6. Copy the Application (client) ID. ContextFill will save that public identifier locally.',
    '   The default tenant is common; pass --tenant with a tenant ID or domain to restrict it.',
    '',
    'ContextFill never asks for a Microsoft client secret.',
  ].join('\n');
}

export async function configureOutlook(
  directory: string,
  clientIdInput: string,
  tenantInput = 'common',
): Promise<string> {
  const clientId = clientIdInput.trim();
  const tenant = tenantInput.trim() || 'common';
  if (!microsoftClientIdPattern.test(clientId)) {
    throw new Error('Microsoft Application (client) ID must be a valid UUID.');
  }
  if (!microsoftTenantPattern.test(tenant)) {
    throw new Error(
      'Microsoft tenant must be common, consumers, organizations, a tenant UUID, or a tenant domain.',
    );
  }

  const { contents: existing, output } = await readPrivateConfiguration(directory);
  let contents = existing;
  contents = replaceEnvironmentValue(contents, 'CONTEXTFILL_MICROSOFT_CLIENT_ID', clientId);
  contents = replaceEnvironmentValue(contents, 'CONTEXTFILL_MICROSOFT_TENANT', tenant);
  await writePrivateConfiguration(output, contents);
  return output;
}

export async function configureGmailFromCredentials(
  directory: string,
  credentialsPath: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ output: string; report: DoctorReport }> {
  const input = resolve(directory, credentialsPath);
  const details = await lstat(input);
  if (!details.isFile() || details.isSymbolicLink() || details.size > 64 * 1024) {
    throw new Error('Google credentials must be a regular JSON file no larger than 64 KB.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(input, 'utf8'));
  } catch {
    throw new Error('Google credentials file is not valid JSON.');
  }
  const parsed = googleCredentialsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Google credentials must contain a valid OAuth Web application client.');
  }
  const setup = inspectMailboxSetup(environment);
  const gmail = setup.providers.find((provider) => provider.provider === 'gmail');
  if (!gmail) throw new Error('Gmail setup metadata is unavailable.');
  if (!parsed.data.web.redirect_uris.includes(gmail.redirectUri)) {
    throw new Error(`Google OAuth client is missing the exact redirect URI: ${gmail.redirectUri}`);
  }

  const { contents: existing, output } = await readPrivateConfiguration(directory);
  let contents = existing;
  contents = replaceEnvironmentValue(
    contents,
    'CONTEXTFILL_GOOGLE_CLIENT_ID',
    parsed.data.web.client_id,
  );
  contents = replaceEnvironmentValue(
    contents,
    'CONTEXTFILL_GOOGLE_CLIENT_SECRET',
    parsed.data.web.client_secret,
  );
  await writePrivateConfiguration(output, contents);
  const report = await inspectCompanionReadiness(directory, {
    ...environment,
    CONTEXTFILL_GOOGLE_CLIENT_ID: parsed.data.web.client_id,
    CONTEXTFILL_GOOGLE_CLIENT_SECRET: parsed.data.web.client_secret,
  });
  return { output, report };
}

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
