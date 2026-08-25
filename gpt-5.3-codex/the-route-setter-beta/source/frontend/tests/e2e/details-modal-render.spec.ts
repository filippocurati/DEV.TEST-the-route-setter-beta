import { expect, test } from '@playwright/test';

test('details modal renders model on visible canvas', async ({ page }) => {
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

  const firstCard = page.locator('.hold-card').first();
  await expect(firstCard).toBeVisible();
  await firstCard.locator('button[data-action="details"]').click();

  await expect(viewport).toHaveAttribute('data-details-open', 'true', { timeout: 60_000 });
  await expect(viewport).toHaveAttribute('data-details-loads', '1', { timeout: 60_000 });

  const canvasMetrics = await page.locator('#details-canvas canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    return {
      width: element.width,
      height: element.height,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight
    };
  });

  expect(canvasMetrics.width).toBeGreaterThan(64);
  expect(canvasMetrics.height).toBeGreaterThan(64);
  expect(canvasMetrics.clientWidth).toBeGreaterThan(64);
  expect(canvasMetrics.clientHeight).toBeGreaterThan(64);

  const near = await viewport.getAttribute('data-details-camera-near');
  const far = await viewport.getAttribute('data-details-camera-far');
  const modelSize = await viewport.getAttribute('data-details-model-size');
  const inFrustum = await viewport.getAttribute('data-details-in-frustum');
  expect(Number(near ?? '0')).toBeGreaterThan(0);
  expect(Number(far ?? '0')).toBeGreaterThan(1);
  expect(Number(modelSize ?? '0')).toBeGreaterThan(0.001);
  expect(inFrustum).toBe('true');
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
