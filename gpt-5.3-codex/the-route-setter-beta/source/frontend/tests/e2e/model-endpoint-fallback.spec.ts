import { expect, test } from '@playwright/test';

test('falls back to manifest modelUrl when /model endpoint URL is unreachable', async ({ page }) => {
  test.setTimeout(120_000);

  await page.route('**/api/holds/*/model', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ url: 'http://127.0.0.1:59999/models/unreachable.glb' })
    });
  });

  await page.goto('/');
  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toHaveAttribute('data-physics', 'ready', { timeout: 60_000 });

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();

  await firstCard.locator('button[data-action="use"]').click();

  await expect(viewport).toHaveAttribute('data-scene-holds', '1', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-template-loads', '1');
});
