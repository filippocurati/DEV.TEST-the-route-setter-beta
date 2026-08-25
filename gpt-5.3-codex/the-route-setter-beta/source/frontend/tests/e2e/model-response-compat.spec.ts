import { expect, test } from '@playwright/test';

test('accepts string JSON payload for /api/holds/{id}/model', async ({ page }) => {
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
      body: '"/data/holds/Hold1/hold1.glb"'
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
  await page.locator(`${holdCardSelector} button[data-action="use"]`).click();

  await expect(viewport).toHaveAttribute('data-scene-holds', '1', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-model-url-fetches', '1');
  await expect(viewport).toHaveAttribute('data-template-loads', '1');

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
