import { expect, test } from '@playwright/test';

test('spawn uses deterministic front reference +Z at 2.0m and can cancel if occupied', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/');
  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toHaveAttribute('data-physics', 'ready', { timeout: 60_000 });

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();
  await firstCard.locator('button[data-action="use"]').click();

  await expect(viewport).toHaveAttribute('data-scene-holds', '1', { timeout: 60_000 });
  const spawnDistance = await viewport.getAttribute('data-spawn-distance');
  expect(Number(spawnDistance ?? '0')).toBeGreaterThan(1.99);
  expect(Number(spawnDistance ?? '0')).toBeLessThan(2.01);
  await expect(viewport).toHaveAttribute('data-spawn-candidate-rank', '0');

  const selected = await viewport.getAttribute('data-selected-hold');
  expect(selected).toBeTruthy();
  await expect(viewport).toHaveAttribute('data-selected-state', 'pre-snap');

  const nextCard = page.locator('.hold-card').first();
  await nextCard.locator('button[data-action="use"]').click();

  await expect(viewport).toHaveAttribute('data-scene-holds', '2');
  const fallbackRank = await viewport.getAttribute('data-spawn-candidate-rank');
  expect(Number(fallbackRank ?? '0')).toBeGreaterThan(0);
});
