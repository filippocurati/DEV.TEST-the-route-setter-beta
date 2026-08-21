import { test, expect } from '@playwright/test';

test('smoke placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/The Route Setter Beta/);
});
