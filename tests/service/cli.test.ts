import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  environmentTemplate,
  initializeConfig,
  inspectCompanionReadiness,
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
});
