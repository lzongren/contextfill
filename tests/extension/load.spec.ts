import { expect, test, chromium } from '@playwright/test';
import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { createServiceApp } from '../../apps/local-service/src/app.js';
import type { MailboxManagerLike } from '../../apps/local-service/src/mailbox.js';
import { PairingManager } from '../../apps/local-service/src/pairing.js';
import { FakeCredentialStore } from '../service/fake-credential-store.js';

test('the packaged MV3 extension loads and boots its popup bundle', async () => {
  const extensionPath = resolve('dist/extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let server: ReturnType<typeof serve> | null = null;
  try {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(serviceWorker.url()).hostname;
    expect(extensionId).toMatch(/^[a-p]{32}$/);

    const mailbox: MailboxManagerLike = {
      statuses: async () => [
        {
          provider: 'gmail',
          configured: false,
          connected: false,
          account: null,
          sessionOnly: true,
          credentialStorage: 'os-keychain',
        },
        {
          provider: 'outlook',
          configured: false,
          connected: false,
          account: null,
          sessionOnly: true,
          credentialStorage: 'os-keychain',
        },
      ],
      beginConnection: async () => 'https://accounts.example/authorize',
      completeConnection: async () => 'person@example.test',
      disconnect: async () => undefined,
      listMessages: async () => [],
    };
    const pairing = new PairingManager({}, new FakeCredentialStore(), Date.now, () => '482913');
    await pairing.bootstrapCode();
    const ready = new Promise<void>((resolveReady) => {
      server = serve(
        {
          fetch: createServiceApp(undefined, mailbox, pairing).fetch,
          hostname: '127.0.0.1',
          port: 4318,
        },
        () => resolveReady(),
      );
    });
    await ready;

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByText('ContextFill', { exact: true })).toBeVisible();
    await expect(popup.getByText('Explicit fill only')).toBeVisible();
    await expect(popup.getByRole('heading')).toContainText(
      /ContextFill cannot inspect|Looking for a trusted match/,
    );

    await popup.getByRole('button', { name: /Message source:/ }).click();
    await expect(
      popup.getByRole('heading', { name: 'Choose where codes come from' }),
    ).toBeVisible();
    await expect(
      popup.locator('.source-card').getByText('Demo inbox', { exact: true }).first(),
    ).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Using demo inbox' })).toBeDisabled();
    await expect(popup.getByText('Pairing required', { exact: true })).toBeVisible();
    await popup.getByRole('textbox', { name: 'Companion service pairing code' }).fill('482913');
    await popup.getByRole('button', { name: 'Pair service' }).click();
    await expect(
      popup.locator('.source-card').getByText('Gmail', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      popup.locator('.source-card').getByText('Outlook', { exact: true }).first(),
    ).toBeVisible();
  } finally {
    if (server) {
      await new Promise<void>((resolveClose, rejectClose) => {
        server!.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }
    await context.close();
  }
});
