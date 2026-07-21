import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const liveEnabled = process.env.CONTEXTFILL_LIVE_ALASKA === '1';
const gmailEnvironment = process.env.CONTEXTFILL_LIVE_GMAIL_ENV;

test.skip(
  !liveEnabled || !gmailEnvironment,
  'Set CONTEXTFILL_LIVE_ALASKA=1 and CONTEXTFILL_LIVE_GMAIL_ENV to run the private live conformance test.',
);

async function waitForCompanion(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new Error('The live companion did not become ready.')),
      15_000,
    );
    const onData = (chunk: Buffer | string) => {
      if (!String(chunk).includes('ContextFill local service listening')) return;
      clearTimeout(timeout);
      resolveReady();
    };
    child.stdout?.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      rejectReady(new Error(`The live companion exited before readiness (${code ?? 'signal'}).`));
    });
  });
}

async function bestEffortUndo(page: Page | null): Promise<void> {
  if (!page || page.isClosed()) return;
  await page
    .evaluate(() => {
      const host = document.querySelector<HTMLElement>('#contextfill-capsule-host');
      const button = host?.shadowRoot?.querySelector<HTMLButtonElement>('button.secondary');
      if (button?.textContent?.includes('Undo')) button.click();
      for (const input of document.querySelectorAll<HTMLInputElement>(
        '#lastName, #confirmationCode',
      )) {
        input.value = '';
      }
    })
    .catch(() => undefined);
}

test('private Gmail confirmation drives an Alaska two-fact capsule without submission', async () => {
  test.setTimeout(120_000);
  const extensionPath = resolve('dist/extension');
  let context: BrowserContext | null = null;
  let companion: ChildProcess | null = null;
  let alaskaPage: Page | null = null;
  try {
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(serviceWorker.url()).hostname;
    companion = spawn(process.execPath, [resolve('dist/local-service/server.js')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: gmailEnvironment,
        CONTEXTFILL_EXTENSION_ID: extensionId,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForCompanion(companion);
    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({ mailSource: 'gmail', usedCandidateIds: [] }),
    );

    alaskaPage = await context.newPage();
    await alaskaPage.route(
      'https://www.alaskaair.com/booking/reservation-lookup',
      async (route) => {
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
      },
    );
    await alaskaPage.goto('https://www.alaskaair.com/booking/reservation-lookup');
    await alaskaPage.evaluate(() => {
      window.__contextfillAlaskaLiveSubmitCount = 0;
      document.querySelector('form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        window.__contextfillAlaskaLiveSubmitCount =
          (window.__contextfillAlaskaLiveSubmitCount ?? 0) + 1;
      });
    });

    await alaskaPage.bringToFront();
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
    await serviceWorker.evaluate(() =>
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html'), active: false }),
    );
    const popup = await popupPromise;
    await expect(popup.getByRole('heading', { name: /Choose (?:this |a )?booking/ })).toBeVisible({
      timeout: 15_000,
    });
    const firstChoice = popup.locator('.capsule-choice').first();
    await expect(firstChoice.locator('code')).toHaveCount(2);
    for (const maskedFact of await firstChoice.locator('code').allTextContents()) {
      expect(maskedFact).toContain('•');
    }
    await firstChoice.getByRole('button', { name: 'Review verified transfer' }).click();
    const transfer = alaskaPage.getByRole('button', { name: 'Transfer 2 verified facts' });
    await expect(transfer).toBeVisible();
    await transfer.click();
    await expect(
      alaskaPage.getByText('2 verified facts transferred. Form not submitted.'),
    ).toBeVisible();
    expect(
      await alaskaPage.evaluate(() => ({
        surnamePresent: Boolean(document.querySelector<HTMLInputElement>('#lastName')?.value),
        confirmationPresent: Boolean(
          document.querySelector<HTMLInputElement>('#confirmationCode')?.value,
        ),
        submits: window.__contextfillAlaskaLiveSubmitCount ?? 0,
      })),
    ).toEqual({ surnamePresent: true, confirmationPresent: true, submits: 0 });
  } finally {
    await bestEffortUndo(alaskaPage);
    companion?.kill('SIGTERM');
    if (context) {
      await Promise.race([
        context.close().catch(() => undefined),
        new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
      ]);
    }
  }
});

declare global {
  interface Window {
    __contextfillAlaskaLiveSubmitCount?: number;
  }
}
