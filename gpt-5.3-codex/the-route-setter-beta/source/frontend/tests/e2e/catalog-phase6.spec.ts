import { expect, test } from '@playwright/test';

test('catalog lifecycle, lazy load and cache', async ({ page }) => {
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

  await page.goto('/');

  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toHaveAttribute('data-physics', 'ready', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-collider-type', '6', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-catalog-fetches', '1');
  await expect(viewport).toHaveAttribute('data-model-url-fetches', '0');
  await expect(viewport).toHaveAttribute('data-template-loads', '0');
  await expect(viewport).toHaveAttribute('data-details-loads', '0');

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();
  const holdId = await firstCard.getAttribute('data-hold-id');
  expect(holdId).toBeTruthy();

  await firstCard.locator('button[data-action="details"]').click();
  await expect(viewport).toHaveAttribute('data-details-open', 'true', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-model-url-fetches', '1');
  await expect(viewport).toHaveAttribute('data-template-loads', '0');
  await expect(viewport).toHaveAttribute('data-details-loads', '1');

  await page.locator('#details-close').click();
  await expect(viewport).toHaveAttribute('data-details-open', 'false');

  const holdCardSelector = `.hold-card[data-hold-id="${holdId}"]`;
  await page.locator(`${holdCardSelector} button[data-action="use"]`).click();
  await expect(viewport).toHaveAttribute('data-scene-holds', '1');
  await expect(viewport).toHaveAttribute('data-selected-hold', holdId ?? '');
  await expect(page.locator(holdCardSelector)).toHaveCount(0);
  await expect(viewport).toHaveAttribute('data-model-url-fetches', '1');
  await expect(viewport).toHaveAttribute('data-template-loads', '1');

  await page.locator('#remove-selected').click();
  await expect(viewport).toHaveAttribute('data-scene-holds', '0');
  await expect(page.locator(holdCardSelector)).toHaveCount(1);

  await page.locator(`${holdCardSelector} button[data-action="use"]`).click();
  await expect(viewport).toHaveAttribute('data-scene-holds', '1');
  await expect(viewport).toHaveAttribute('data-model-url-fetches', '1');
  await expect(viewport).toHaveAttribute('data-template-loads', '1');

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
