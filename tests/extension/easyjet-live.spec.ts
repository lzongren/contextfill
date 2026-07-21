import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test, chromium, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const liveEnabled = process.env.CONTEXTFILL_LIVE_EASYJET === '1';
const gmailEnvironment = process.env.CONTEXTFILL_LIVE_GMAIL_ENV;

test.skip(
  !liveEnabled || !gmailEnvironment,
  'Set CONTEXTFILL_LIVE_EASYJET=1 and CONTEXTFILL_LIVE_GMAIL_ENV to run the private live conformance test.',
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
      const button = host?.shadowRoot?.querySelector<HTMLButtonElement>(
        'button.primary, button.secondary',
      );
      if (button?.textContent?.includes('Undo')) button.click();
      for (const input of document.querySelectorAll<HTMLInputElement>(
        'input[placeholder="Surname(s)"], input[placeholder="Booking reference"]',
      )) {
        input.value = '';
      }
    })
    .catch(() => undefined);
}

test('private Gmail confirmation fills only the evidenced easyJet reference when surname is absent', async () => {
  test.setTimeout(120_000);
  const extensionPath = resolve('dist/extension');
  let context: BrowserContext | null = null;
  let companion: ChildProcess | null = null;
  let easyJetPage: Page | null = null;
  try {
    console.log('live-stage: launch-extension');
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(serviceWorker.url()).hostname;
    console.log('live-stage: start-companion');
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
    await serviceWorker.evaluate(() => chrome.storage.local.set({ mailSource: 'gmail' }));

    console.log('live-stage: open-easyjet');
    easyJetPage = await context.newPage();
    await easyJetPage.route('https://www.easyjet.com/en?accntmdl=2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <main><h1>Find booking</h1>
            <form action="https://www.easyjet.com/en?accntmdl=2">
              <label>Surname(s)<input type="text" aria-label="Please enter a valid surname to find your booking" placeholder="Surname(s)"></label>
              <label>Booking reference<input type="text" aria-label="Please enter a valid booking reference to find your booking" placeholder="Booking reference"></label>
              <label><input id="FIND_BOOKING_CHECKBOX_DATA_ID" type="checkbox" aria-label="Check the box to confirm that you have permission to manage this booking on behalf of the passenger(s) or that you are the only passenger">Permission to manage booking</label>
              <button type="submit" aria-label="Find booking">Find Booking</button>
            </form>
          </main>
        </body></html>`,
      });
    });
    await easyJetPage.goto('https://www.easyjet.com/en?accntmdl=2', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    console.log('live-stage: easyjet-committed');
    console.log('live-stage: booking-tab-open');
    await expect(easyJetPage.getByPlaceholder('Booking reference', { exact: true })).toBeVisible();
    await easyJetPage.evaluate(() => {
      window.__contextfillLiveSubmitCount = 0;
      const form = document.querySelector<HTMLFormElement>(
        'input[placeholder="Booking reference"]',
      )?.form;
      form?.addEventListener('submit', (event: Event) => {
        window.__contextfillLiveSubmitCount = (window.__contextfillLiveSubmitCount ?? 0) + 1;
        event.preventDefault();
      });
    });

    console.log('live-stage: open-packaged-popup');
    await easyJetPage.bringToFront();
    const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
    await serviceWorker.evaluate(() =>
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html'), active: false }),
    );
    const popup = await popupPromise;
    console.log('live-stage: read-gmail');
    await expect(
      popup.getByRole('heading', { name: /Choose (?:this |a )?booking reference/ }),
    ).toBeVisible({ timeout: 15_000 });
    const firstChoice = popup.locator('.capsule-choice').first();
    await expect(firstChoice).toBeVisible();
    await expect(firstChoice.locator('code')).toHaveCount(1);
    for (const maskedFact of await firstChoice.locator('code').allTextContents()) {
      expect(maskedFact).toContain('•');
    }
    console.log('live-stage: choose-masked-booking');
    await firstChoice.getByRole('button', { name: 'Review reference-only transfer' }).click();
    await expect(popup.getByText(/does not state a passenger surname/i)).toBeVisible();
    await popup.getByRole('button', { name: 'Fill reference' }).click();
    console.log('live-stage: transferred');
    await expect(popup.getByRole('heading', { name: 'Reference filled' })).toBeVisible();
    await expect(popup.getByText(/enter it yourself/i)).toBeVisible();

    const transferState = await easyJetPage.evaluate(() => ({
      surnamePresent: Boolean(
        document.querySelector<HTMLInputElement>('input[placeholder="Surname(s)"]')?.value,
      ),
      bookingPresent: Boolean(
        document.querySelector<HTMLInputElement>('input[placeholder="Booking reference"]')?.value,
      ),
      consentChecked:
        document.querySelector<HTMLInputElement>('#FIND_BOOKING_CHECKBOX_DATA_ID')?.checked ??
        false,
      submits: window.__contextfillLiveSubmitCount ?? 0,
    }));
    expect(transferState).toEqual({
      surnamePresent: false,
      bookingPresent: true,
      consentChecked: false,
      submits: 0,
    });
  } finally {
    console.log('live-stage: cleanup');
    await bestEffortUndo(easyJetPage);
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
    __contextfillLiveSubmitCount?: number;
  }
}
