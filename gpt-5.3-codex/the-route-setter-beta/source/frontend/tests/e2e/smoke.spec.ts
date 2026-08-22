import { test, expect } from '@playwright/test';

test('smoke placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/The Route Setter Beta/);
  const viewport = page.getByLabel('Viewport 3D');
  await expect(viewport).toBeVisible();
  await expect(page.getByText(/OrbitControls attivi/i)).toBeVisible({ timeout: 30_000 });

  await page.mouse.move(260, 260);
  await page.mouse.down();
  await page.mouse.move(420, 220);
  await page.mouse.up();
  await page.mouse.wheel(0, -240);

  await expect(viewport).toHaveAttribute('data-physics', 'ready');
  await expect(viewport).toHaveAttribute('data-collider-type', '6');
});
