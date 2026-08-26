import { expect, test } from '@playwright/test';

test('l’endpoint modello espone il vero filename GLB al browser', async ({ page, request }) => {
  const response = await request.get('/api/holds/Hold1/model');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('model/gltf-binary');
  expect(response.headers()['content-disposition']).toContain('inline');
  expect(response.headers()['content-disposition']).toContain('hold1.glb');

  await page.goto('/');
  await page.evaluate(() => {
    const anchor = document.createElement('a');
    anchor.id = 'model-download-test';
    anchor.href = '/api/holds/Hold1/model';
    anchor.download = '';
    anchor.textContent = 'Scarica modello';
    document.body.append(anchor);
  });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#model-download-test').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('hold1.glb');
});
