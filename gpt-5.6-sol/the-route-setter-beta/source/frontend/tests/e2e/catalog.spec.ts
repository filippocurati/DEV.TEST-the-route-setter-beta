import { expect, test } from '@playwright/test';

test.describe('catalogo prese', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
  });

  test('popola card e preview senza eager-load dei GLB', async ({ page }) => {
    const modelRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/model')) {
        modelRequests.push(new URL(request.url()).pathname);
      }
    });
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });

    const cards = page.locator('.hold-card');
    await expect(cards).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Hold1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hold2' })).toBeVisible();
    await expect(page.getByAltText('Anteprima Hold1')).toBeVisible();
    expect(modelRequests).toEqual([]);
  });

  test('carica dettagli on-demand e rilascia la viewport alla chiusura', async ({ page }) => {
    const hold1 = page.locator('[data-hold-id="Hold1"]');
    const modelRequests: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/model')) modelRequests.push(path);
    });

    await hold1.getByRole('button', { name: 'Dettagli' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Dettagli Hold1' })).toBeVisible();
    await expect(dialog.locator('[data-details-canvas]')).toBeVisible({ timeout: 60_000 });
    expect(modelRequests).toEqual(['/api/holds/Hold1/model']);

    await dialog.getByRole('button', { name: 'Chiudi dettagli' }).click();

    await expect(dialog).not.toBeVisible();
    await expect(dialog.locator('[data-details-canvas]')).toHaveCount(0);
    await expect(hold1).toBeVisible();

    await hold1.getByRole('button', { name: 'Dettagli' }).click();
    await expect(dialog.locator('[data-details-canvas]')).toBeVisible({ timeout: 60_000 });
    expect(modelRequests).toEqual(['/api/holds/Hold1/model', '/api/holds/Hold1/model']);
    await dialog.getByRole('button', { name: 'Chiudi dettagli' }).click();
  });

  test('sposta una presa in scena una sola volta e la riporta nel catalogo', async ({ page }) => {
    const hold1 = page.locator('[data-hold-id="Hold1"]');
    const requests: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.includes('/api/holds/Hold1/')) requests.push(path);
    });

    await hold1.getByRole('button', { name: 'Utilizza' }).click();

    await expect(hold1).toHaveCount(0);
    await expect(page.locator('[data-catalog-count]')).toHaveText('1');
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
    const scene = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__);
    expect(scene?.holdInstanceIds).toEqual(['Hold1']);
    expect(scene?.holdStates.Hold1.attachment).toBe('pre-snap');
    expect(scene!.selectedHoldPosition![2] - scene!.wallFrontReference[2]).toBeCloseTo(2, 4);
    expect(scene?.holdStates.Hold1.localNormal).toEqual([0, 0, 1]);
    expect(scene?.holdStates.Hold1.intersectsAtSpawn).toBe(false);
    expect(requests).toContain('/api/holds/Hold1/model');
    expect(requests).toContain('/api/holds/Hold1/collider');
    expect(requests.filter((path) => path.endsWith('/model'))).toHaveLength(1);

    await page.getByRole('button', { name: 'Rimuovi presa' }).click();

    await expect(page.locator('[data-hold-id="Hold1"]')).toBeVisible();
    await expect(page.locator('[data-catalog-count]')).toHaveText('2');
    expect((await page.evaluate(() => window.__ROUTE_SETTER_SCENE__))?.holdInstanceIds).toEqual([]);
  });

  test('usa la griglia deterministica per uno spawn multiplo libero', async ({ page }) => {
    await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
    await page.locator('[data-hold-id="Hold2"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold2 aggiunta alla scena.', { timeout: 120_000 });

    const scene = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
    expect(scene.holdInstanceIds).toEqual(['Hold1', 'Hold2']);
    expect(scene.holdStates.Hold1.spawnOffset).toEqual([0, 0]);
    expect(scene.holdStates.Hold1.spawnCandidateIndex).toBe(0);
    expect(scene.holdStates.Hold2.spawnCandidateIndex).toBeGreaterThan(0);
    expect(scene.holdStates.Hold2.spawnOffset).not.toEqual([0, 0]);
    expect(scene.holdStates.Hold1.intersectsAtSpawn).toBe(false);
    expect(scene.holdStates.Hold2.intersectsAtSpawn).toBe(false);
    expect(scene.selectedHoldPosition![2] - scene.wallFrontReference[2]).toBeCloseTo(2, 4);
  });
});
