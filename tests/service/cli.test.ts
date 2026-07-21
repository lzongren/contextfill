import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  configureGmailFromCredentials,
  configureOutlook,
  environmentTemplate,
  gmailSetupInstructions,
  initializeConfig,
  inspectCompanionReadiness,
  outlookSetupInstructions,
} from '../../apps/local-service/src/cli.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('installable companion CLI', () => {
  it('creates a private config template without overwriting an existing file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-cli-'));
    temporaryDirectories.push(directory);
    const output = await initializeConfig(directory);

    expect(await readFile(output, 'utf8')).toBe(environmentTemplate);
    if (process.platform !== 'win32') {
      expect((await stat(output)).mode & 0o777).toBe(0o600);
    }
    await expect(initializeConfig(directory)).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it('reports exact callbacks and provider readiness without printing credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-doctor-'));
    temporaryDirectories.push(directory);
    await initializeConfig(directory);
    const clientId = '11111111-2222-4333-8444-555555555555';
    const report = await inspectCompanionReadiness(directory, {
      CONTEXTFILL_SERVICE_PORT: '4318',
      CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: 'http://localhost:4318',
      CONTEXTFILL_MICROSOFT_CLIENT_ID: clientId,
      CONTEXTFILL_MICROSOFT_TENANT: 'common',
    });

    expect(report.ok).toBe(true);
    expect(report.text).toContain('Outlook: ready');
    expect(report.text).toContain('Gmail: not configured');
    expect(report.text).toContain('http://localhost:4318/mail/oauth/outlook/callback');
    expect(report.text).toContain('Mail.Read');
    expect(report.text).not.toContain(clientId);
  });

  it('fails early for a mismatched callback port', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-doctor-invalid-'));
    temporaryDirectories.push(directory);
    const report = await inspectCompanionReadiness(directory, {
      CONTEXTFILL_SERVICE_PORT: '4318',
      CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: 'http://localhost:9000',
      CONTEXTFILL_MICROSOFT_CLIENT_ID: '11111111-2222-4333-8444-555555555555',
    });

    expect(report.ok).toBe(false);
    expect(report.text).toContain('port must match CONTEXTFILL_SERVICE_PORT');
  });

  it('guides Outlook registration using runtime-derived settings', () => {
    const guide = outlookSetupInstructions({
      CONTEXTFILL_SERVICE_PORT: '4318',
      CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: 'http://localhost:4318',
    });

    expect(guide).toContain('Microsoft Entra app registrations');
    expect(guide).toContain('http://localhost:4318/mail/oauth/outlook/callback');
    expect(guide).toContain('Mail.Read');
    expect(guide).toContain('User.Read');
    expect(guide).toContain('personal Outlook.com account can use the finished connector');
    expect(guide).toContain('Application Developer role');
    expect(guide).toContain('never asks for a Microsoft client secret');
  });

  it('guides Gmail web-client creation using runtime-derived settings', () => {
    const guide = gmailSetupInstructions({
      CONTEXTFILL_SERVICE_PORT: '4318',
      CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: 'http://localhost:4318',
    });

    expect(guide).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(guide).toContain('http://localhost:4318/mail/oauth/gmail/callback');
    expect(guide).toContain('--setup gmail --credentials');
    expect(guide).toContain('never prints either credential');
  });

  it('privately imports a matching Google web client without printing credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-setup-gmail-'));
    temporaryDirectories.push(directory);
    const credentials = join(directory, 'client-secret.json');
    const clientId = '123456789-contextfill.apps.googleusercontent.com';
    const clientSecret = 'fake-google-client-secret';
    await writeFile(
      credentials,
      JSON.stringify({
        web: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uris: ['http://localhost:4318/mail/oauth/gmail/callback'],
        },
      }),
      { mode: 0o600 },
    );

    const result = await configureGmailFromCredentials(directory, credentials, {
      CONTEXTFILL_SERVICE_PORT: '4318',
      CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: 'http://localhost:4318',
    });
    const saved = await readFile(result.output, 'utf8');

    expect(result.report.ok).toBe(true);
    expect(result.report.text).toContain('Gmail: ready');
    expect(result.report.text).not.toContain(clientId);
    expect(result.report.text).not.toContain(clientSecret);
    expect(saved).toContain(`CONTEXTFILL_GOOGLE_CLIENT_ID=${clientId}`);
    expect(saved).toContain(`CONTEXTFILL_GOOGLE_CLIENT_SECRET=${clientSecret}`);
    if (process.platform !== 'win32') {
      expect((await stat(result.output)).mode & 0o777).toBe(0o600);
    }
  });

  it('rejects a Google web client whose registered callback does not match runtime', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-setup-gmail-invalid-'));
    temporaryDirectories.push(directory);
    const credentials = join(directory, 'client-secret.json');
    await writeFile(
      credentials,
      JSON.stringify({
        web: {
          client_id: '123456789-contextfill.apps.googleusercontent.com',
          client_secret: 'fake-google-client-secret',
          redirect_uris: ['http://localhost:9999/wrong'],
        },
      }),
    );

    await expect(
      configureGmailFromCredentials(directory, credentials, {
        CONTEXTFILL_SERVICE_PORT: '4318',
        CONTEXTFILL_OAUTH_REDIRECT_ORIGIN: 'http://localhost:4318',
      }),
    ).rejects.toThrow('missing the exact redirect URI');
    await expect(readFile(join(directory, '.env'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('saves Outlook public-client settings privately without replacing other configuration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-setup-outlook-'));
    temporaryDirectories.push(directory);
    const config = join(directory, '.env');
    await writeFile(
      config,
      [
        'OPENAI_API_KEY=keep-this-value',
        'CONTEXTFILL_GOOGLE_CLIENT_SECRET=keep-this-secret',
        'CONTEXTFILL_MICROSOFT_CLIENT_ID=old',
        'CONTEXTFILL_MICROSOFT_CLIENT_ID=duplicate',
        'CONTEXTFILL_MICROSOFT_TENANT=organizations',
        '',
      ].join('\n'),
      { mode: 0o644 },
    );
    const clientId = '11111111-2222-4333-8444-555555555555';

    expect(await configureOutlook(directory, clientId, 'common')).toBe(config);
    const saved = await readFile(config, 'utf8');

    expect(saved).toContain('OPENAI_API_KEY=keep-this-value');
    expect(saved).toContain('CONTEXTFILL_GOOGLE_CLIENT_SECRET=keep-this-secret');
    expect(saved).toContain(`CONTEXTFILL_MICROSOFT_CLIENT_ID=${clientId}`);
    expect(saved.match(/CONTEXTFILL_MICROSOFT_CLIENT_ID=/gu)).toHaveLength(1);
    expect(saved).toContain('CONTEXTFILL_MICROSOFT_TENANT=common');
    if (process.platform !== 'win32') {
      expect((await stat(config)).mode & 0o777).toBe(0o600);
    }
  });

  it('rejects malformed Outlook registration values before writing configuration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'contextfill-setup-invalid-'));
    temporaryDirectories.push(directory);

    await expect(configureOutlook(directory, 'not-a-client-id')).rejects.toThrow(
      'client) ID must be a valid UUID',
    );
    await expect(
      configureOutlook(directory, '11111111-2222-4333-8444-555555555555', 'bad tenant'),
    ).rejects.toThrow('Microsoft tenant must be');
    await expect(readFile(join(directory, '.env'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
