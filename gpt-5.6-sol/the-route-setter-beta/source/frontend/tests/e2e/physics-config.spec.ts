import { expect, test, type Page } from '@playwright/test';

const configRoute = '**/physics-config.json';
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(({ page }) => {
  expect(pageErrors.get(page), 'Il bootstrap non deve generare eccezioni JavaScript non gestite').toEqual([]);
});

test('carica il file reale a 5 mm una volta e non lo richiede durante le interazioni', async ({ page }) => {
  let configRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/physics-config.json')) configRequests += 1;
  });
  const configResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/physics-config.json'));

  await page.goto('/');
  const response = await configResponse;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ wallPenetrationToleranceMm: 5 });
  await expectReady(page, 5);
  expect(configRequests).toBe(1);

  await exerciseCamera(page);

  await expectReady(page, 5);
  expect(configRequests).toBe(1);
});

for (const wallTolerance of [3, 10]) {
  test(`applica ${wallTolerance} mm solo al reload, con una richiesta per bootstrap e prese sempre a 1 mm`, async ({ page }) => {
    let configRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/physics-config.json')) configRequests += 1;
    });
    await page.goto('/');
    await expectReady(page, 5);
    expect(configRequests).toBe(1);

    // Simula il cambio del file pubblico senza modificarlo sul disco.
    await page.route(configRoute, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ wallPenetrationToleranceMm: wallTolerance }),
    }));
    await exerciseCamera(page);
    await expectReady(page, 5);
    expect(configRequests).toBe(1);

    await page.reload();
    await expectReady(page, wallTolerance);
    expect(configRequests).toBe(2);

    await exerciseCamera(page);
    await expectReady(page, wallTolerance);
    expect(configRequests).toBe(2);
  });
}

for (const { name, status, body, message } of [
  { name: 'valore sotto 1 mm', status: 200, body: '{"wallPenetrationToleranceMm":0.5}', message: /tolleranza parete.*numero tra 1 e 10 mm/i },
  { name: 'valore stringa', status: 200, body: '{"wallPenetrationToleranceMm":"5"}', message: /tolleranza parete.*numero tra 1 e 10 mm/i },
  { name: 'chiave sconosciuta', status: 200, body: '{"wallPenetrationToleranceMm":5,"extra":true}', message: /tolleranza parete.*numero tra 1 e 10 mm/i },
  { name: 'chiave mancante', status: 200, body: '{}', message: /tolleranza parete.*numero tra 1 e 10 mm/i },
  { name: 'file mancante HTTP 404', status: 404, body: 'RAW_HTTP_DETAILS', message: /physics-config\.json.*ricaricare la pagina/i },
  { name: 'errore HTTP 500', status: 500, body: 'RAW_HTTP_DETAILS', message: /physics-config\.json.*ricaricare la pagina/i },
  { name: 'JSON malformato', status: 200, body: '{"wallPenetrationToleranceMm":RAW_PARSE_DETAILS}', message: /physics-config\.json.*ricaricare la pagina/i },
  { name: 'JSON con commento', status: 200, body: '{"wallPenetrationToleranceMm":5 /* RAW_PARSE_DETAILS */}', message: /physics-config\.json.*ricaricare la pagina/i },
]) {
  test(`fallisce in sicurezza per ${name}`, async ({ page }) => {
    let configRequests = 0;
    await page.route(configRoute, (route) => {
      configRequests += 1;
      return route.fulfill({ status, contentType: 'application/json', body });
    });

    await page.goto('/');
    await expectSafeFailure(page, message);
    expect(configRequests).toBe(1);
  });
}

test('fallisce in sicurezza se la richiesta di configurazione viene interrotta', async ({ page }) => {
  await page.route(configRoute, (route) => route.abort('failed'));

  await page.goto('/');
  await expectSafeFailure(page, /physics-config\.json.*ricaricare la pagina/i);
});

async function expectReady(page: Page, wall: number): Promise<void> {
  await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
  await expect(page.getByRole('status')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('[data-scene-canvas]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.collisionTolerancesMm))
    .toEqual({ wall, holds: 1 });
  expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.physicsReady)).toBe(true);
}

async function exerciseCamera(page: Page): Promise<void> {
  const box = await page.locator('[data-scene-canvas]').boundingBox();
  expect(box).not.toBeNull();
  const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.cameraPosition);

  await page.mouse.move(box!.x + box!.width * 0.55, box!.y + box!.height * 0.5);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(box!.x + box!.width * 0.72, box!.y + box!.height * 0.38, { steps: 5 });
  await page.mouse.up({ button: 'left' });
  await page.mouse.wheel(0, -350);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box!.x + box!.width * 0.67, box!.y + box!.height * 0.58, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__?.cameraPosition)).not.toEqual(before);
  // Lascia completare anche gli aggiornamenti camera successivi agli eventi di input.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function expectSafeFailure(page: Page, message: RegExp): Promise<void> {
  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('data-state', 'error');
  await expect(status).toBeVisible();
  await expect(status).toContainText(/Impossibile inizializzare/);
  const feedback = page.locator('[data-catalog-feedback]');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(message);
  await expect(feedback).not.toContainText(/RAW_|SyntaxError|TypeError|Unexpected token|Failed to fetch/);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeDisabled();
  expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__)).toBeUndefined();
}
