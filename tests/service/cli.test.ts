import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  configureOutlook,
  environmentTemplate,
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
    expect(guide).toContain('never asks for a Microsoft client secret');
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
