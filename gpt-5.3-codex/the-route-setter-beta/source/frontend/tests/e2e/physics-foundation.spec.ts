import { expect, test } from '@playwright/test';

test('physics foundation runtime flags are active and stable', async ({ page }) => {
  const requests: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/')) {
      requests.push(url);
    }
  });

  await page.goto('/');

  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toBeVisible();
  await expect(page.getByText(/OrbitControls attivi/i)).toBeVisible({ timeout: 30_000 });
  await expect(viewport).toHaveAttribute('data-physics', 'ready');
  await expect(viewport).toHaveAttribute('data-collider-type', '6');
  await expect(viewport).toHaveAttribute('data-gravity', '{"x":0,"y":0,"z":0}');
  await expect(viewport).toHaveAttribute('data-kinematic-controller', 'ready');
  await expect(viewport).toHaveAttribute('data-network-loop', 'none');

  const startupCalls = requests.length;
  await page.waitForTimeout(1200);
  const afterLoopCalls = requests.length;

  expect(afterLoopCalls).toBe(startupCalls);
  expect(requests.filter((requestUrl) => requestUrl.includes('/api/wall')).length).toBeGreaterThanOrEqual(1);
});
