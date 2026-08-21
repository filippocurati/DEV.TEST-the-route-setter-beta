import { expect, test } from '@playwright/test';

test('avvia il frontend applicativo', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'The Route Setter' })).toBeVisible();
});
