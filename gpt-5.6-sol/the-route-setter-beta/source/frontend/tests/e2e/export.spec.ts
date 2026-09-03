import { expect, test } from '@playwright/test';

test('genera un JPG ad alta risoluzione e ripristina scena e UI', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
  await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  await expect(page.getByRole('toolbar', { name: 'Azioni presa selezionata' })).toBeVisible();
  const canvas = page.locator('[data-scene-canvas]');
  const viewport = await canvas.boundingBox();
  await page.mouse.move(viewport!.x + viewport!.width * 0.5, viewport!.y + viewport!.height * 0.5);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(viewport!.x + viewport!.width * 0.65, viewport!.y + viewport!.height * 0.38);
  await page.mouse.up({ button: 'left' });
  await page.mouse.wheel(0, -450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(viewport!.x + viewport!.width * 0.6, viewport!.y + viewport!.height * 0.58);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Genera immagine' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const values: number[] = [];
  for await (const chunk of stream! as AsyncIterable<Uint8Array>) {
    values.push(...chunk);
  }
  const bytes = new Uint8Array(values);
  const dimensions = readJpegDimensions(bytes);

  expect(download.suggestedFilename()).toBe('the-route-setter-guide.jpg');
  expect(bytes.length).toBeGreaterThan(10_000);
  expect(Array.from(bytes.slice(0, 2))).toEqual([0xff, 0xd8]);
  expect(Array.from(bytes.slice(-2))).toEqual([0xff, 0xd9]);
  expect(Math.max(dimensions.width, dimensions.height)).toBe(2560);
  expect(dimensions.width / dimensions.height).toBeCloseTo(viewport!.width / viewport!.height, 2);
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.height).toBeGreaterThan(0);
  await expect(page.locator('[data-catalog-feedback]')).toContainText('Immagine guida generata');
  expect(await page.locator('html').getAttribute('data-exporting')).toBeNull();
  await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Catalogo prese' })).toBeVisible();
  await expect(page.locator('[data-scene-canvas]')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Azioni presa selezionata' })).toBeVisible();
  const after = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__);
  expect(after?.cameraPosition).toEqual(before?.cameraPosition);
  expect(after?.cameraQuaternion).toEqual(before?.cameraQuaternion);
  expect(after?.cameraFov).toBe(before?.cameraFov);
  expect(after?.cameraZoom).toBe(before?.cameraZoom);
  expect(after?.cameraNear).toBe(before?.cameraNear);
  expect(after?.cameraFar).toBe(before?.cameraFar);
  expect(after?.cameraAspect).toBeCloseTo(before!.cameraAspect, 6);
  expect(after?.controlsTarget).toEqual(before?.controlsTarget);
  expect(after?.holdInstanceIds).toEqual(before?.holdInstanceIds);
  expect(after?.selectedHoldId).toBe(before?.selectedHoldId);
  expect(after?.lastExportCamera?.position).toEqual(before?.cameraPosition);
  expect(after?.lastExportCamera?.quaternion).toEqual(before?.cameraQuaternion);
  expect(after?.lastExportCamera?.fov).toBe(before?.cameraFov);
  expect(after?.lastExportCamera?.zoom).toBe(before?.cameraZoom);
  expect(after?.lastExportCamera?.near).toBe(before?.cameraNear);
  expect(after?.lastExportCamera?.far).toBe(before?.cameraFar);
  expect(after?.lastExportCamera?.aspect).toBeCloseTo(dimensions.width / dimensions.height, 6);
});

/** Legge il primo marker SOF JPEG e ne restituisce le dimensioni codificate. */
function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + segmentLength;
  }
  throw new Error('Dimensioni JPEG non trovate.');
}
