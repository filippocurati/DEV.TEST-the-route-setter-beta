import { expect, test, type Page } from '@playwright/test';
import type { FrontendLogDto } from '../../src/errors/ErrorReporter';

const errorId = '12345678-1234-1234-1234-123456789abc';
const requestId = 'original-request:01';
const logs = new WeakMap<Page, FrontendLogDto[]>();
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000);
  const events: FrontendLogDto[] = [];
  const errors: string[] = [];
  logs.set(page, events);
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/logs', async route => {
    events.push(route.request().postDataJSON() as FrontendLogDto);
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ requestId: 'log-request' }) });
  });
});

test.afterEach(({ page }, testInfo) => {
  if (!testInfo.title.includes('guasti globali')) expect(pageErrors.get(page)).toEqual([]);
  const serialized = JSON.stringify(logs.get(page));
  expect(serialized).not.toMatch(/RAW_|private\.invalid|secret-value|\.stack|https?:/);
});

test('errore HTTP del modello: UI sicura, correlazione preservata e recupero locale', async ({ page }) => {
  await ready(page);
  await page.route('**/api/holds/Hold1/model', route => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({
      errorId, requestId, message: 'RAW_BACKEND https://private.invalid/?token=secret-value',
    }),
  }));
  await page.locator('[data-hold-id="Hold1"] [data-use]').click();
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Impossibile caricare la risorsa richiesta.');
  await expect.poll(() => logs.get(page)?.length).toBe(1);
  expect(logs.get(page)![0]).toMatchObject({ errorId, requestId, category: 'Http', component: 'HoldPlacement' });
  await expect(page.locator('[data-hold-id="Hold1"]')).toBeVisible();
  await expectSceneAlive(page);
  await page.unroute('**/api/holds/Hold1/model');
  await page.locator('[data-hold-id="Hold1"] [data-use]').click();
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  expect((await page.evaluate(() => window.__ROUTE_SETTER_SCENE__))?.holdInstanceIds).toEqual(['Hold1']);
  expect(logs.get(page)).toHaveLength(1);
});

for (const fault of ['rete', 'GLB malformato', 'risorsa secondaria']) {
  test(`contiene ${fault}, deduplica i log e conserva la scena`, async ({ page }) => {
    await ready(page);
    await page.route('**/api/holds/Hold1/model', route => {
      if (fault === 'rete') return route.abort('failed');
      const body = fault === 'GLB malformato' ? 'RAW_GLB secret-value' : JSON.stringify({
        asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
        bufferViews: [{ buffer: 0, byteLength: 36 }], buffers: [{ uri: 'missing.bin', byteLength: 36 }],
      });
      return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body });
    });
    await page.route('**/api/holds/Hold1/assets/missing.bin', route => route.abort('failed'));
    for (let i = 0; i < 3; i += 1) {
      await page.locator('[data-hold-id="Hold1"] [data-details]').click();
      await expect(page.locator('[data-catalog-feedback]')).toContainText(/Impossibile (caricare|leggere)/);
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    await expect.poll(() => logs.get(page)?.length).toBe(1);
    await page.waitForTimeout(1_200);
    expect(logs.get(page)).toHaveLength(1);
    await expectSceneAlive(page);
  });
}

test('guasti globali: notifica sicura senza sopprimere gli errori nativi attesi', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    setTimeout(() => { throw new TypeError('RAW_GLOBAL secret-value'); }, 0);
    setTimeout(() => { void Promise.reject(new Error('RAW_REJECTION secret-value')); }, 50);
  });
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Si e verificato un errore. Riprova o ricarica la pagina.');
  await expect.poll(() => logs.get(page)?.length).toBe(2);
  await expect.poll(() => pageErrors.get(page)?.length).toBe(2);
  expect(pageErrors.get(page)).toEqual(['RAW_GLOBAL secret-value', 'RAW_REJECTION secret-value']);
  expect(logs.get(page)!.map(log => log.component)).toEqual(['GlobalError', 'GlobalPromise']);
  await expectSceneAlive(page);
});

test('un errore di posa previsto non invia log nemmeno durante il targeting', async ({ page }) => {
  await ready(page);
  await page.locator('[data-hold-id="Hold1"] [data-use]').click();
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  const canvas = page.locator('[data-scene-canvas]');
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.getByRole('button', { name: 'Aggancia', exact: true }).click();
  await page.mouse.move(x, y);
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.previewObjectCount)).toBe(1);
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.holdStates.Hold1.physicalState)).toBe('attached');
  await page.locator('[data-hold-id="Hold2"] [data-use]').click();
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold2 aggiunta alla scena.', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Aggancia', exact: true }).click();
  await page.mouse.move(x, y);
  const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.selectedHoldPosition);
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.lastActionResult?.status)).toBe('invalid-target');
  expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.selectedHoldPosition)).toEqual(before);
  await page.waitForTimeout(1_200);
  expect(logs.get(page)).toEqual([]);
  await expectSceneAlive(page);
});

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
  await expect(page.locator('.hold-card')).toHaveCount(2);
}

async function expectSceneAlive(page: Page): Promise<void> {
  await expect(page.locator('[data-scene-canvas]')).toBeVisible();
  expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.physicsReady)).toBe(true);
  const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.cameraPosition);
  await page.locator('[data-scene-canvas]').hover();
  await page.mouse.wheel(0, -200);
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.cameraPosition)).not.toEqual(before);
}
