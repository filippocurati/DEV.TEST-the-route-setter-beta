import { expect, test } from '@playwright/test';

test('carica automaticamente parete e TriMesh', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'The Route Setter' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Parete pronta');
  await expect(page.locator('[data-scene-canvas]')).toBeVisible();

  const scene = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__);
  expect(scene?.wallLoaded).toBe(true);
  expect(scene?.triMeshVertexCount).toBeGreaterThan(0);
  expect(scene?.triMeshIndexCount).toBeGreaterThan(0);
  expect(scene!.triMeshIndexCount % 3).toBe(0);
  expect(scene?.controlsTarget).toEqual(scene?.wallCenter);
});

test('orbit zoom e pan mantengono un target valido sulla parete', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Parete pronta');
  const canvas = page.locator('[data-scene-canvas]');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__);

  await page.mouse.move(box!.x + box!.width * 0.55, box!.y + box!.height * 0.5);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(box!.x + box!.width * 0.72, box!.y + box!.height * 0.38);
  await page.mouse.up({ button: 'left' });
  await page.mouse.wheel(0, -350);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box!.x + box!.width * 0.67, box!.y + box!.height * 0.58);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__);
  expect(after?.cameraPosition).not.toEqual(before?.cameraPosition);
  expect(after?.controlsTarget.every(Number.isFinite)).toBe(true);
  const targetDistanceFromWall = Math.hypot(
    after!.controlsTarget[0] - after!.wallCenter[0],
    after!.controlsTarget[1] - after!.wallCenter[1],
    after!.controlsTarget[2] - after!.wallCenter[2],
  );
  expect(targetDistanceFromWall).toBeLessThan(after!.wallMaxDimension);
});

test('mantiene la scena utilizzabile su viewport mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('status')).toHaveText('Parete pronta');
  const canvas = page.locator('[data-scene-canvas]');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  expect(box?.height).toBeGreaterThan(600);
});
