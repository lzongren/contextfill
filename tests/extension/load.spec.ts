import { expect, test, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('the packaged MV3 extension loads and boots its popup bundle', async () => {
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
    expect(extensionId).toMatch(/^[a-p]{32}$/);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByText('ContextFill', { exact: true })).toBeVisible();
    await expect(popup.getByText('Explicit fill only')).toBeVisible();
    await expect(popup.getByRole('heading')).toContainText(
      /ContextFill cannot inspect|Looking for a trusted match/,
    );
  } finally {
    await context.close();
  }
});
