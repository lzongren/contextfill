import { chromium, expect, test } from '@playwright/test';
import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { createServiceApp } from '../../apps/local-service/src/app.js';
import type { MailboxManagerLike } from '../../apps/local-service/src/mailbox.js';
import { PairingManager } from '../../apps/local-service/src/pairing.js';
import type { MailboxMessage } from '../../packages/core/src/index.js';
import { FakeCredentialStore } from '../service/fake-credential-store.js';

const alaskaMessage: MailboxMessage = {
  id: 'gmail:alaska-packaged',
  source: 'gmail',
  senderName: 'Alaska Airlines Reservation',
  senderAddress: 'reservation@email.alaskaair.com',
  senderRelay: null,
  subject: 'Your flight is booked: ALTEST to Seattle on 08/16/2026',
  body: `Alaska Airlines
Confirmation code: ALTEST
Manage trip: https://click.email.alaskaair.com/manage
Traveler(s):
SAMPLE RIVERA
27F · Class: L COACH
Special information related to your trip:`,
  receivedAt: '2026-07-20T18:00:00.000Z',
  expiresAt: null,
  serviceHint: 'Alaska Airlines',
};

const unrelatedMessage: MailboxMessage = {
  id: 'gmail:unrelated-tennis',
  source: 'gmail',
  senderName: 'Tennis Express',
  senderAddress: 'support@tennisexpress.com',
  senderRelay: null,
  subject: 'FLASH SALE: Up to 60% Off!',
  body: 'Use offer code SALELD at https://www.tennisexpress.com/ today.',
  receivedAt: '2026-07-21T17:00:00.000Z',
  expiresAt: null,
  serviceHint: null,
};

test('packaged Gmail-to-Alaska capsule selects only the booking and never submits', async () => {
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
    let requestedPurpose: string | undefined;
    const mailbox: MailboxManagerLike = {
      statuses: async () => [
        {
          provider: 'gmail',
          configured: true,
          connected: true,
          account: 'person@gmail.example',
          sessionOnly: false,
          credentialStorage: 'os-keychain',
        },
        {
          provider: 'outlook',
          configured: false,
          connected: false,
          account: null,
          sessionOnly: true,
          credentialStorage: 'session',
        },
      ],
      beginConnection: async () => 'https://accounts.example/authorize',
      completeConnection: async () => 'person@gmail.example',
      disconnect: async () => undefined,
      listMessages: async (_provider, purpose) => {
        requestedPurpose = purpose;
        return [unrelatedMessage, alaskaMessage];
      },
    };
    const pairing = new PairingManager(
      { CONTEXTFILL_EXTENSION_ID: extensionId },
      new FakeCredentialStore(),
    );
    await new Promise<void>((resolveReady) => {
      server = serve(
        {
          fetch: createServiceApp(undefined, mailbox, pairing).fetch,
          hostname: '127.0.0.1',
          port: 4318,
        },
        () => resolveReady(),
      );
    });
    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({ mailSource: 'gmail', usedCandidateIds: [] }),
    );

    const page = await context.newPage();
    await page.route('https://www.alaskaair.com/booking/reservation-lookup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <main><h1>Manage reservation</h1>
            <form action="https://www.alaskaair.com/booking/reservation-lookup">
              <label>Passenger's last name<input id="lastName" type="text"></label>
              <label>Confirmation code or e-ticket #<input id="confirmationCode" type="text"></label>
              <button type="submit">Continue</button>
            </form>
          </main>
        </body></html>`,
      });
    });
    await page.goto('https://www.alaskaair.com/booking/reservation-lookup');
    await page.evaluate(() => {
      window.__contextfillAlaskaSubmitCount = 0;
      document.querySelector('form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        window.__contextfillAlaskaSubmitCount = (window.__contextfillAlaskaSubmitCount ?? 0) + 1;
      });
    });

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.bringToFront();
    await popup.evaluate(() => window.location.reload());
    await expect(popup.getByRole('heading', { name: 'Choose this booking' })).toBeVisible();
    expect(requestedPurpose).toBe('alaska_booking_lookup');
    await expect(popup.getByText('Tennis Express')).toHaveCount(0);
    await expect(popup.locator('body')).not.toContainText('ALTEST');
    await expect(popup.locator('body')).not.toContainText('Rivera');
    await popup.getByRole('button', { name: 'Review verified transfer' }).click();

    const transfer = page.getByRole('button', { name: 'Transfer 2 verified facts' });
    await expect(transfer).toBeVisible();
    await expect(transfer).toBeEnabled();
    await expect(page.locator('#contextfill-capsule-host')).not.toContainText('ALTEST');
    await expect(page.locator('#contextfill-capsule-host')).not.toContainText('Rivera');
    await transfer.click();
    await expect(page.locator('#lastName')).toHaveValue('RIVERA');
    await expect(page.locator('#confirmationCode')).toHaveValue('ALTEST');
    await expect(page.getByText('2 verified facts transferred. Form not submitted.')).toBeVisible();
    expect(await page.evaluate(() => window.__contextfillAlaskaSubmitCount)).toBe(0);
    await page.getByRole('button', { name: 'Undo entire handoff' }).click();
    await expect(page.locator('#lastName')).toHaveValue('');
    await expect(page.locator('#confirmationCode')).toHaveValue('');
  } finally {
    if (server) {
      const runningServer = server as ReturnType<typeof serve>;
      runningServer.close();
    }
    await Promise.race([
      context.close().catch(() => undefined),
      new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
    ]);
  }
});

declare global {
  interface Window {
    __contextfillAlaskaSubmitCount?: number;
  }
}
