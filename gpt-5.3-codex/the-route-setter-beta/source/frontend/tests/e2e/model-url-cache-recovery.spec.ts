import { expect, test } from '@playwright/test';

test('recovers from cached invalid model url by refetching endpoint', async ({ page }) => {
  test.setTimeout(120_000);

  let modelCalls = 0;

  await page.route('**/api/holds/*/model', async (route) => {
    modelCalls += 1;

    if (modelCalls === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ url: 'http://127.0.0.1:59999/data/holds/Hold1/hold1.glb' })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ url: '/data/holds/Hold1/hold1.glb' })
    });
  });

  await page.goto('/');
  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toHaveAttribute('data-physics', 'ready', { timeout: 60_000 });

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();

  await firstCard.locator('button[data-action="use"]').click();
  await expect(viewport).toHaveAttribute('data-scene-holds', '0');

  await firstCard.locator('button[data-action="details"]').click();
  await expect(viewport).toHaveAttribute('data-details-loads', '1', { timeout: 60_000 });

  expect(modelCalls).toBeGreaterThanOrEqual(2);
});
