import { chromium, expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const demoRoot = resolve('dist/demo');
const capsuleFixturePort = 4179;

function contentType(pathname: string): string {
  if (extname(pathname) === '.js') return 'text/javascript; charset=utf-8';
  if (extname(pathname) === '.css') return 'text/css; charset=utf-8';
  return 'text/html; charset=utf-8';
}

async function startDemoServer(): Promise<Server | null> {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${capsuleFixturePort}`)
        .pathname;
      if (pathname === '/untrusted.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html><html><head>
          <meta name="contextfill-scenario" content="capsule">
          <meta name="contextfill-simulated-host" content="checkin.aurelia-air.test">
          <meta name="contextfill-service" content="Aurelia Air">
        </head><body><form><label>Booking reference<input></label><label>Passenger surname<input></label></form></body></html>`);
        return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const target = resolve(demoRoot, relative);
      if (!target.startsWith(`${demoRoot}/`) && target !== resolve(demoRoot, 'index.html')) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': contentType(target) });
      response.end(await readFile(target));
    } catch {
      if (!response.headersSent && !response.destroyed) response.writeHead(404).end();
      else response.destroy();
    }
  });
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(capsuleFixturePort, '127.0.0.1', resolveReady);
  });
  return server;
}

test('packaged capsule blocks a lookalike, transfers exactly two facts, and undoes without replay', async () => {
  const server = await startDemoServer();
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${resolve('dist/extension')}`,
      `--load-extension=${resolve('dist/extension')}`,
    ],
  });
  try {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${capsuleFixturePort}/untrusted.html`);
    await expect(page.locator('#contextfill-capsule-host')).toHaveCount(0);

    await page.goto(
      `http://127.0.0.1:${capsuleFixturePort}/?scenario=capsule-lookalike&extension=1`,
    );
    await expect(page.locator('#contextfill-capsule-host')).toBeAttached();
    await expect(page.getByText('Transfer blocked')).toBeVisible();
    await expect(page.locator('#contextfill-capsule-host').getByRole('status')).toContainText(
      'resembles the airline domain',
    );
    await expect(page.getByRole('button', { name: 'Transfer 2 verified facts' })).toHaveCount(0);
    await expect(page.locator('#bookingReference')).toHaveValue('');
    await expect(page.locator('#passengerSurname')).toHaveValue('');

    await page.goto(`http://127.0.0.1:${capsuleFixturePort}/?scenario=capsule-decoy&extension=1`);
    const transfer = page.getByRole('button', { name: 'Transfer 2 verified facts' });
    await expect
      .poll(() =>
        page.locator('#contextfill-capsule-host').evaluate((host) => {
          const root = host.shadowRoot;
          return {
            result: root?.querySelector('.result')?.textContent,
            mappingClass: root?.querySelector('[data-stage="mapping"]')?.className,
            disabled: (root?.querySelector('.primary') as HTMLButtonElement | null)?.disabled,
          };
        }),
      )
      .toEqual({
        result: 'Trust verified. Review the masked field map before transfer.',
        mappingClass: 'node mapping active',
        disabled: false,
      });
    await expect(transfer).toBeEnabled();
    await expect(page.locator('#contextfill-capsule-host')).not.toContainText('AU-47K2');
    await expect(page.locator('#contextfill-capsule-host')).not.toContainText('Rivera');
    await transfer.click();
    await expect(page.locator('#bookingReference')).toHaveValue('AU-47K2');
    await expect(page.locator('#passengerSurname')).toHaveValue('Rivera');
    await expect(page.locator('#loyaltyNumber')).toHaveValue('');
    await expect(page.locator('#hiddenBookingDecoy')).toHaveValue('DO-NOT-CHANGE');
    await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
    await expect(page.getByText('2 verified facts transferred. Form not submitted.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo entire handoff' }).click();
    await expect(page.locator('#bookingReference')).toHaveValue('');
    await expect(page.locator('#passengerSurname')).toHaveValue('');

    await page.evaluate(() => document.dispatchEvent(new CustomEvent('contextfill:show-capsule')));
    await expect(page.getByText(/already transferred during this browser session/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transfer 2 verified facts' })).toHaveCount(0);
  } finally {
    await context.close();
    if (server) {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }
  }
});
