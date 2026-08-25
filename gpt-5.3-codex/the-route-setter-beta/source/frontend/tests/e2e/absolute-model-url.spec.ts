import { expect, test } from '@playwright/test';

test('works when model endpoint returns absolute backend URL', async ({ page }) => {
  test.setTimeout(120_000);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.route('**/api/holds/*/model', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ url: 'http://127.0.0.1:5099/data/holds/Hold1/hold1.glb' })
    });
  });

  await page.goto('/');

  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toHaveAttribute('data-physics', 'ready', { timeout: 60_000 });

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();
  const holdId = await firstCard.getAttribute('data-hold-id');
  expect(holdId).toBeTruthy();

  const holdCardSelector = `.hold-card[data-hold-id="${holdId}"]`;

  await page.locator(`${holdCardSelector} button[data-action="details"]`).click();
  await expect(viewport).toHaveAttribute('data-details-loads', '1', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-details-open', 'true');
  await page.locator('#details-close').click();

  await page.locator(`${holdCardSelector} button[data-action="use"]`).click();
  await expect(viewport).toHaveAttribute('data-scene-holds', '1', { timeout: 60_000 });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
