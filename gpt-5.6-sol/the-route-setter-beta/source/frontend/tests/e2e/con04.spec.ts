import { expect, test, type Page } from '@playwright/test';
import type { HoldManifest } from '../../src/api/holdApi';

/** Attende il bootstrap senza cambiare configurazione o tolleranze fisiche. */
async function ready(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('[data-scene-canvas]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.physicsReady), { timeout: 60_000 }).toBe(true);
}

/** Inserisce la presa usata dalle regressioni di interazione. */
async function addHold(page: Page): Promise<void> {
  await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.selectedHoldId), { timeout: 120_000 }).toBe('Hold1');
}

/** Restituisce il centro corrente del canvas in coordinate client. */
async function center(page: Page) {
  const box = (await page.locator('[data-scene-canvas]').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('CON04 lifecycle browser', () => {
  test.setTimeout(180_000);

  for (const staleFailure of [false, true]) {
    test(`dettagli close/reopen con ${staleFailure ? 'errore' : 'successo'} obsoleto ritardato`, async ({ page }) => {
      await ready(page);
      const manifest = await (await page.request.get('/api/holds')).json() as HoldManifest[];
      const first = manifest.find(hold => hold.id === 'Hold1')!;
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let entered!: () => void;
      const requested = new Promise<void>(resolve => { entered = resolve; });
      let completed!: () => void;
      const delivered = new Promise<void>(resolve => { completed = resolve; });
      const faults: string[] = [];
      page.on('pageerror', error => faults.push(error.message));
      await page.route(`**${first.modelUrl}`, async route => {
        const response = staleFailure ? undefined : await route.fetch();
        entered();
        await gate;
        if (staleFailure) await route.fulfill({ status: 500, body: 'delayed failure' });
        else await route.fulfill({ response });
        completed();
      });
      await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Dettagli' }).click();
      await requested;
      await page.locator('[data-close-details]').click();
      await page.locator('[data-hold-id="Hold2"]').getByRole('button', { name: 'Dettagli' }).click();
      await expect(page.locator('[data-details-canvas]')).toHaveCount(1, { timeout: 120_000 });
      release();
      await delivered;
      // Lascia consumare parsing, catch e callback DOM del vecchio caricamento.
      await page.waitForTimeout(500);
      await expect(page.locator('[data-details-title]')).toHaveText('Dettagli Hold2');
      await expect(page.locator('[data-details-canvas]')).toHaveCount(1);
      await expect(page.locator('dialog[open]')).toBeVisible();
      expect(faults).toEqual([]);
      await page.locator('[data-close-details]').click();
      await expect(page.locator('[data-details-canvas]')).toHaveCount(0);
    });
  }

  test('shadow segue il puntatore fermo dopo zoom senza validare nuove pose', async ({ page }) => {
    await ready(page);
    await addHold(page);
    await page.getByRole('button', { name: 'Aggancia', exact: true }).click();
    const point = await center(page);
    await page.mouse.move(point.x + 35, point.y + 25);
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.targetShadowPosition)).not.toBeNull();
    const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
    await page.mouse.wheel(0, -240);
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.targetShadowPosition)).not.toEqual(before.targetShadowPosition);
    const after = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
    expect(after.targetShadowPosition).not.toBeNull();
    expect(after.previewObjectCount).toBe(1);
    expect(after.poseValidationCount).toBe(before.poseValidationCount);
    expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.previewObjectCount)).toBe(0);
  });

  test('resize durante drag si applica al termine e conserva selezione dopo aggancio', async ({ page }) => {
    await ready(page);
    await addHold(page);
    await page.getByRole('button', { name: 'Aggancia', exact: true }).click();
    const point = await center(page);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.holdStates.Hold1.physicalState)).toBe('attached');
    await expect(page.getByRole('button', { name: 'Sposta', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.selectedHoldId)).toBe('Hold1');
    await page.getByRole('button', { name: 'Sposta', exact: true }).click();
    const arrow = (await page.locator('[data-move="right"]').boundingBox())!;
    await page.mouse.move(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2);
    await page.mouse.down();
    await page.mouse.move(arrow.x + arrow.width / 2 + 15, arrow.y + arrow.height / 2);
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.dragPreview)).not.toBeNull();
    const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.cameraAspect);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width + 120, height: viewport.height + 40 });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.cameraAspect)).toBe(before);
    await page.mouse.up();
    const aspect = await page.locator('[data-scene-canvas]').evaluate(canvas => {
      const viewport = canvas.parentElement!;
      return viewport.clientWidth / viewport.clientHeight;
    });
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.cameraAspect)).toBe(aspect);
    expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.orbitControlsEnabled)).toBe(true);
    expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.previewObjectCount)).toBe(0);
  });

  test('export ripetuti preservano camera, asset e conteggi delle risorse interattive', async ({ page, browser }, testInfo) => {
    const diagnostics: unknown[] = [{ browser: browser.version(), started: new Date().toISOString() }];
    /** Conserva la disconnessione anche quando il browser non produce una trace. */
    const disconnected = (): void => { diagnostics.push({ event: 'browser-disconnected' }); };
    browser.on('disconnected', disconnected);
    page.on('crash', () => diagnostics.push({ event: 'page-crash' }));
    page.on('pageerror', error => diagnostics.push({ event: 'pageerror', message: error.message }));
    page.on('console', message => {
      if (message.type() === 'warning' || message.type() === 'error') diagnostics.push({ event: 'console', type: message.type(), message: message.text() });
    });
    try {
      await ready(page, '/?performance=1');
      await addHold(page);
      await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.snapshot().geometries)).toBeGreaterThan(0);
      // Attende il rendering della presa prima di misurare le risorse GPU interattive.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const before = await page.evaluate(() => ({
        scene: window.__ROUTE_SETTER_SCENE__!, memory: window.__ROUTE_SETTER_PERFORMANCE__!.snapshot(),
      }));
      diagnostics.push({ event: 'ready', memory: before.memory });
      const assets: string[] = [];
      page.on('request', request => {
        if (/\/model(?:\?|$)|\.glb(?:\?|$)|\/assets\//i.test(request.url())) assets.push(request.url());
      });
      for (let index = 0; index < 3; index += 1) {
        diagnostics.push({ event: 'export-start', index });
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Genera immagine', exact: true }).click();
        const image = await download;
        // L'evento download segnala l'avvio, non il completamento del file.
        expect(await image.failure()).toBeNull();
        diagnostics.push({ event: 'download-complete', index });
        await expect(page.getByRole('button', { name: 'Genera immagine', exact: true })).toBeEnabled();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const after = await page.evaluate(() => ({
          scene: window.__ROUTE_SETTER_SCENE__!, memory: window.__ROUTE_SETTER_PERFORMANCE__!.snapshot(),
        }));
        diagnostics.push({ event: 'export-complete', index, memory: after.memory });
        expect(after.scene.lastExportCamera?.aspect).toBe(before.scene.cameraAspect);
        expect(after.scene.cameraPosition).toEqual(before.scene.cameraPosition);
        expect(after.scene.selectedHoldId).toBe(before.scene.selectedHoldId);
        expect(after.memory.geometries).toBe(before.memory.geometries);
        expect(after.memory.textures).toBe(before.memory.textures);
        await expect(page.locator('canvas')).toHaveCount(1);
      }
      expect(assets).toEqual([]);
    } finally {
      diagnostics.push({ event: 'finish', pageClosed: page.isClosed(), browserConnected: browser.isConnected() });
      browser.off('disconnected', disconnected);
      await testInfo.attach('export-runtime', { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' });
    }
  });
});
