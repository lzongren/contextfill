import { chromium, expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const demoRoot = resolve('dist/demo');

function contentType(pathname: string): string {
  if (extname(pathname) === '.js') return 'text/javascript; charset=utf-8';
  if (extname(pathname) === '.css') return 'text/css; charset=utf-8';
  return 'text/html; charset=utf-8';
}

async function startDemoServer(): Promise<Server | null> {
  try {
    const existing = await fetch('http://127.0.0.1:4173/?scenario=magic-link');
    if (existing.ok && (await existing.text()).includes('ContextFill')) return null;
  } catch {
    // Start the packaged fixture server below.
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1:4173').pathname;
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const target = resolve(demoRoot, relative);
      if (!target.startsWith(`${demoRoot}/`) && target !== resolve(demoRoot, 'index.html')) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': contentType(target) });
      response.end(await readFile(target));
    } catch {
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(404).end();
      } else {
        response.destroy();
      }
    }
  });
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(4173, '127.0.0.1', () => resolveReady());
  });
  return server;
}

test('verified magic link and trusted reference require explicit, same-context actions', async () => {
  const server = await startDemoServer();
  const extensionPath = resolve('dist/extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(serviceWorker.url()).hostname;

    const initiatingTab = await context.newPage();
    await initiatingTab.goto('http://127.0.0.1:4173/?scenario=magic-link');
    const initiatingUrl = initiatingTab.url();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await initiatingTab.bringToFront();
    await popup.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('Scan again'),
      );
      button?.click();
    });

    await expect(
      popup.getByRole('button', { name: 'Open verified link in this tab' }),
    ).toBeVisible();
    await expect(popup.getByText('https://login.cedarnotes.test/magic/••••')).toBeVisible();
    await expect(
      popup.locator('.evidence-row').filter({ hasText: 'Link destination' }),
    ).toContainText('login.cedarnotes.test');
    await expect(popup.locator('body')).not.toContainText('sample-token');
    expect(initiatingTab.url()).toBe(initiatingUrl);

    await popup.getByRole('button', { name: 'Open verified link in this tab' }).click();
    await initiatingTab.waitForURL('**/?scenario=magic-link-complete');
    await expect(initiatingTab.getByText('Verified handoff completed')).toBeVisible();

    await initiatingTab.goto('http://127.0.0.1:4173/?scenario=magic-link');
    await initiatingTab.bringToFront();
    await popup.evaluate(() => window.location.reload());
    await expect(popup.getByText('Trust decision · Blocked')).toBeVisible();
    await expect(popup.getByText(/already opened during this browser session/)).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Open verified link in this tab' })).toHaveCount(
      0,
    );

    await initiatingTab.goto('http://127.0.0.1:4173/?scenario=reference');
    await initiatingTab.bringToFront();
    await popup.evaluate(() => window.location.reload());
    await expect(popup.getByRole('button', { name: 'Fill reference' })).toBeVisible();
    await expect(popup.getByText('Candidate reference')).toBeVisible();
    await expect(popup.locator('body')).not.toContainText('CT-7K92Q');
    await expect(initiatingTab.locator('#bookingReference')).toHaveValue('');
    await popup.getByRole('button', { name: 'Fill reference' }).click();
    await expect(initiatingTab.locator('#bookingReference')).toHaveValue('CT-7K92Q');
    await expect(initiatingTab.locator('#verification-form')).toHaveAttribute(
      'data-submit-count',
      '0',
    );
  } finally {
    await context.close();
    if (server) {
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      });
    }
  }
});
