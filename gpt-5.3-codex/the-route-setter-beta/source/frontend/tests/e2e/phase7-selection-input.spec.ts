import { expect, test } from '@playwright/test';

test('selection, remove, button commands and keyboard shortcuts', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/');
  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toHaveAttribute('data-physics', 'ready', { timeout: 60_000 });

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();
  await expect(page.locator('.hold-card').nth(1)).toBeVisible();

  const firstId = await firstCard.getAttribute('data-hold-id');
  const secondId = await page.locator('.hold-card').nth(1).getAttribute('data-hold-id');
  expect(firstId).toBeTruthy();
  expect(secondId).toBeTruthy();

  await firstCard.locator('button[data-action="use"]').click();
  await expect(viewport).toHaveAttribute('data-scene-holds', '1', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-selected-hold', firstId ?? '');

  const spawnCancelledAfterSecondUse = await (async () => {
    await page.locator(`.hold-card[data-hold-id="${secondId}"] button[data-action="use"]`).click();
    await page.waitForTimeout(200);
    const sceneHolds = await viewport.getAttribute('data-scene-holds');
    const cancelReason = await viewport.getAttribute('data-spawn-cancelled');
    return {
      sceneHolds,
      cancelReason
    };
  })();

  if (spawnCancelledAfterSecondUse.sceneHolds === '2') {
    await expect(viewport).toHaveAttribute('data-selected-hold', secondId ?? '');
  } else {
    expect(spawnCancelledAfterSecondUse.sceneHolds).toBe('1');
    expect(spawnCancelledAfterSecondUse.cancelReason === '' || spawnCancelledAfterSecondUse.cancelReason === 'occupied-or-penetrating').toBeTruthy();
  }

  await page.mouse.click(500, 300);
  await expect(viewport).toHaveAttribute('data-selection-active', 'true');

  const beforeForward = await page.locator('#scene-mount').getAttribute('data-selected-state');
  expect(beforeForward).toBe('pre-snap');

  await page.locator('#cmd-forward').dispatchEvent('pointerdown');
  await page.waitForTimeout(120);
  await page.locator('#cmd-forward').dispatchEvent('pointerup');

  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyD');

  await expect(page.locator('#remove-selected')).toBeEnabled();
  const beforeRemoveCount = Number((await viewport.getAttribute('data-scene-holds')) ?? '0');
  await page.locator('#remove-selected').click();
  const expectedAfterRemove = Math.max(0, beforeRemoveCount - 1).toString();
  await expect(viewport).toHaveAttribute('data-scene-holds', expectedAfterRemove);

  const removedCard = page.locator(`.hold-card[data-hold-id="${secondId}"]`);
  if (spawnCancelledAfterSecondUse.sceneHolds === '2') {
    await expect(removedCard).toHaveCount(1);
  }
});
