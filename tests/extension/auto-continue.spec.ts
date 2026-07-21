import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
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
    const existing = await fetch('http://127.0.0.1:4173/?scenario=legitimate-single');
    if (existing.ok && (await existing.text()).includes('ContextFill')) return null;
  } catch {
    // Start a packaged fixture server below.
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
      if (!response.headersSent && !response.destroyed) response.writeHead(404).end();
      else response.destroy();
    }
  });
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(4173, '127.0.0.1', () => resolveReady());
  });
  return server;
}

async function extensionContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  const extensionPath = resolve('dist/extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let [serviceWorker] = context.serviceWorkers();
  serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
  return { context, extensionId: new URL(serviceWorker.url()).hostname };
}

async function openAutomationSettings(
  context: BrowserContext,
  extensionId: string,
  initiatingTab: Page,
): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await initiatingTab.bringToFront();
  await popup.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Automation',
    );
    button?.click();
  });
  await expect(
    popup.getByRole('heading', { name: /Choose how ContextFill works on 127\.0\.0\.1/ }),
  ).toBeVisible();
  return popup;
}

async function enableAutoContinue(popup: Page): Promise<void> {
  await popup.bringToFront();
  await popup.locator('.automation-consent input').check();
  await popup.getByRole('button', { name: 'Enable Auto-Continue' }).click();
  await expect
    .poll(() =>
      popup.evaluate(async () => {
        const stored = await chrome.storage.local.get(['automationSiteRules']);
        return Array.isArray(stored.automationSiteRules) ? stored.automationSiteRules.length : 0;
      }),
    )
    .toBe(1);
  await expect(popup.getByRole('button', { name: 'Auto-Continue is enabled' })).toBeDisabled();
}

async function enableAssisted(popup: Page): Promise<void> {
  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Enable Assisted' }).click();
  await expect
    .poll(() =>
      popup.evaluate(async () => {
        const stored = await chrome.storage.local.get(['automationSiteRules']);
        return Array.isArray(stored.automationSiteRules)
          ? stored.automationSiteRules[0]?.mode
          : null;
      }),
    )
    .toBe('assisted');
  await expect(popup.getByRole('button', { name: 'Assisted is enabled' })).toBeDisabled();
}

test('Assisted mode detects and verifies automatically but waits for an in-page confirmation', async () => {
  const server = await startDemoServer();
  const { context, extensionId } = await extensionContext();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/?scenario=legitimate-single');
    const popup = await openAutomationSettings(context, extensionId, page);
    await enableAssisted(popup);
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'verified',
    );
    await expect(page.locator('#verificationCode')).toHaveValue('');
    await page.bringToFront();
    await page.locator('#contextfill-auto-continue').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#verificationCode')).toHaveValue('481203');
    await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
  } finally {
    await context.close();
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});

test('a configured SPA starts Assisted verification when its email wait state appears later', async () => {
  const server = await startDemoServer();
  const { context, extensionId } = await extensionContext();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/?scenario=legitimate-single');
    await page.locator('#verification-form').evaluate((form) => form.remove());
    const popup = await openAutomationSettings(context, extensionId, page);
    await enableAssisted(popup);
    await expect(page.locator('#contextfill-auto-continue')).toHaveCount(0);

    await page.evaluate(() => {
      const form = document.createElement('form');
      form.id = 'late-verification-form';
      const label = document.createElement('label');
      label.htmlFor = 'late-verification-code';
      label.textContent = 'Enter the verification code we sent to your email';
      const input = document.createElement('input');
      input.id = 'late-verification-code';
      input.name = 'verificationCode';
      input.autocomplete = 'one-time-code';
      input.inputMode = 'numeric';
      input.maxLength = 6;
      form.append(label, input);
      document.body.append(form);
    });

    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'verified',
      { timeout: 8_000 },
    );
    await expect(page.locator('#late-verification-code')).toHaveValue('');
  } finally {
    await context.close();
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});

test('Auto-Continue fills a trusted OTP without the popup action and records no submit click', async () => {
  const server = await startDemoServer();
  const { context, extensionId } = await extensionContext();
  try {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4173/?scenario=legitimate-single');
    const popup = await openAutomationSettings(context, extensionId, page);
    await enableAutoContinue(popup);
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'countdown',
    );
    await expect(page.locator('#verificationCode')).toHaveValue('481203', { timeout: 8_000 });
    await expect(page.locator('#verificationCode')).toHaveAttribute(
      'data-contextfill-filled',
      'true',
    );
    await expect(page.locator('#verificationCode')).toHaveCSS('transition-property', 'none');
    await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'success',
    );

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.getByText('http://127.0.0.1:4173', { exact: true })).toBeVisible();
    await expect(options.getByText('Verified code filled')).toBeVisible();
    await expect(options.locator('body')).not.toContainText('481203');
  } finally {
    await context.close();
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});

test('Auto-Continue opens an aligned magic link in the same tab', async () => {
  const server = await startDemoServer();
  const { context, extensionId } = await extensionContext();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/?scenario=magic-link');
    const popup = await openAutomationSettings(context, extensionId, page);
    await enableAutoContinue(popup);
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'countdown',
    );
    await page.waitForURL('**/?scenario=magic-link-complete', { timeout: 8_000 });
    await expect(page.getByText('Verified handoff completed')).toBeVisible();
  } finally {
    await context.close();
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});

test('Auto-Continue blocks a magic-link lookalike before navigation', async () => {
  const server = await startDemoServer();
  const { context, extensionId } = await extensionContext();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/?scenario=magic-link-lookalike');
    const popup = await openAutomationSettings(context, extensionId, page);
    await enableAutoContinue(popup);
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'blocked',
      { timeout: 8_000 },
    );
    await expect(page.getByText('Waiting for your explicit email action')).toBeVisible();
    await page.waitForTimeout(3_500);
    expect(page.url()).toContain('scenario=magic-link-lookalike');

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.locator('.meta').filter({ hasText: 'lookalike' })).toHaveCount(1);
  } finally {
    await context.close();
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});

test('the in-page countdown can be cancelled and revoking the site disables future scans', async () => {
  const server = await startDemoServer();
  const { context, extensionId } = await extensionContext();
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/?scenario=magic-link');
    const popup = await openAutomationSettings(context, extensionId, page);
    await enableAutoContinue(popup);
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'countdown',
    );
    await page.bringToFront();
    await page.locator('#contextfill-auto-continue').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contextfill-auto-continue')).toHaveAttribute(
      'data-state',
      'success',
    );
    await page.waitForTimeout(3_500);
    expect(page.url()).toContain('scenario=magic-link');

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.getByRole('button', { name: /Revoke ContextFill automation/ }).click();
    await expect(options.getByText(/No sites have Assisted or Auto-Continue access/)).toBeVisible();
    await page.goto('http://127.0.0.1:4173/?scenario=legitimate-single');
    await page.waitForTimeout(1_000);
    await expect(page.locator('#verificationCode')).toHaveValue('');
    await expect(page.locator('#contextfill-auto-continue')).toHaveCount(0);
  } finally {
    await context.close();
    if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});
