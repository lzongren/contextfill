import { expect, test } from '@playwright/test';

test('legitimate single-field fixture fills but never submits', async ({ page }) => {
  await page.goto('/?scenario=legitimate-single');
  await expect(page.getByText('SIMULATED ACTIVE DOMAIN')).toBeVisible();
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'allow',
    fieldKind: 'single',
    fieldCount: 1,
  });
  expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(true);
  await expect(page.locator('#verificationCode')).toHaveValue('481203');
  await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
});

test('split-field fixture fills digits in order and preserves unrelated control', async ({
  page,
}) => {
  await page.goto('/?scenario=legitimate-split');
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'allow',
    fieldKind: 'split',
    fieldCount: 6,
  });
  expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(true);
  expect(
    await page
      .locator('.digit-row input')
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
  ).toEqual(['4', '8', '1', '2', '0', '3']);
  await expect(page.locator('#remember')).not.toBeChecked();
  await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
});

test('lookalike, service mismatch, and expiry fixtures remain unchanged', async ({ page }) => {
  for (const [scenario, reasonCode] of [
    ['lookalike', 'lookalike'],
    ['mismatch', 'service_mismatch'],
    ['expired', 'expired'],
  ]) {
    await page.goto(`/?scenario=${scenario}`);
    expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
      decision: 'block',
      reasonCode,
    });
    expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(false);
    await expect(page.locator('#verificationCode')).toHaveValue('');
    await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
  }
});

test('unrelated numeric email produces a clear empty fixture', async ({ page }) => {
  await page.goto('/?scenario=empty');
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'empty',
    reasonCode: 'no_candidate',
  });
  expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(false);
  await expect(page.locator('#verificationCode')).toHaveValue('');
});

test('ambiguous sender fixture warns and does not fill without override', async ({ page }) => {
  await page.goto('/?scenario=ambiguous');
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'warn',
    reasonCode: 'sender_conflict',
  });
  expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(false);
  await expect(page.locator('#verificationCode')).toHaveValue('');
  await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');
});

test('magic-link fixtures allow aligned handoff context and block a lookalike without navigating', async ({
  page,
}) => {
  await page.goto('/?scenario=magic-link');
  const before = page.url();
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'allow',
    reasonCode: 'aligned',
    fieldKind: 'none',
  });
  expect(page.url()).toBe(before);

  await page.goto('/?scenario=magic-link-lookalike');
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'block',
    reasonCode: 'lookalike',
    fieldKind: 'none',
  });
  await expect(page.getByText('Waiting for your explicit email action')).toBeVisible();
});

test('trusted reference transfer fills only the matching field and blocks a lookalike site', async ({
  page,
}) => {
  await page.goto('/?scenario=reference');
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'allow',
    reasonCode: 'aligned',
    fieldKind: 'reference',
  });
  expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(true);
  await expect(page.locator('#bookingReference')).toHaveValue('CT-7K92Q');
  await expect(page.locator('#verification-form')).toHaveAttribute('data-submit-count', '0');

  await page.goto('/?scenario=reference-lookalike');
  expect(await page.evaluate(() => window.contextFillHarness.inspect())).toMatchObject({
    decision: 'block',
    reasonCode: 'lookalike',
  });
  expect(await page.evaluate(() => window.contextFillHarness.fill())).toBe(false);
  await expect(page.locator('#bookingReference')).toHaveValue('');
});

declare global {
  interface Window {
    contextFillHarness: {
      inspect: () => {
        decision: string;
        reasonCode: string;
        fieldKind: string;
        fieldCount: number;
      };
      fill: () => boolean;
    };
  }
}
