import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { environmentTemplate, initializeConfig } from '../../apps/local-service/src/cli.js';

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
});
