import { expect, test } from '@playwright/test';
import type { HoldManifest, HoldReadiness } from '../../src/api/holdApi';

for (const terminal of ['Ready', 'Failed'] as const) {
  test(`readiness Pending -> ${terminal} aggiorna il catalogo senza reload e arresta il polling`, async ({ page }) => {
    test.setTimeout(180_000);
    const requests: string[] = [];
    let navigations = 0;
    let statusRequests = 0;
    let actual: readonly HoldManifest[] = [];
    let releaseTerminal!: () => void;
    const terminalGate = new Promise<void>(resolve => { releaseTerminal = resolve; });
    page.on('request', request => {
      requests.push(new URL(request.url()).pathname);
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations += 1;
    });
    await page.route('**/api/holds', async route => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      actual = await response.json() as HoldManifest[];
      expect(actual.find(hold => hold.id === 'Hold1')).toMatchObject({
        colliderStatus: 'Ready', colliderUrl: '/api/holds/Hold1/collider',
      });
      // Gli altri job devono essere terminali per poter verificare l'arresto globale.
      expect(actual.every(hold => ['Ready', 'Failed'].includes(hold.colliderStatus))).toBe(true);
      await route.fulfill({ response, json: actual.map(hold => hold.id === 'Hold1'
        ? { ...hold, colliderStatus: 'Pending', colliderUrl: null }
        : hold) });
    });
    await page.route('**/api/holds/status', async route => {
      statusRequests += 1;
      const first = statusRequests === 1;
      if (!first) await terminalGate;
      const states: HoldReadiness[] = actual.map(({ id, colliderStatus, colliderUrl }) => {
        if (id !== 'Hold1') return { id, colliderStatus, colliderUrl };
        return {
          id,
          colliderStatus: first ? 'Pending' : terminal,
          colliderUrl: !first && terminal === 'Ready' ? colliderUrl : null,
        };
      });
      await route.fulfill({ json: states });
    });

    const firstStatus = page.waitForResponse(response => new URL(response.url()).pathname === '/api/holds/status', {
      timeout: 120_000,
    });
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
    const hold1 = page.locator('[data-hold-id="Hold1"]');
    const use = hold1.getByRole('button', { name: 'Utilizza' });
    await firstStatus;
    await expect(hold1.locator('.collider-state')).toHaveText('Pending');
    await expect(use).toBeDisabled();
    await expect(hold1.getByAltText('Anteprima Hold1')).toBeVisible();
    expect(requests.filter(path => path === '/api/holds')).toHaveLength(1);
    expect(requests.filter(path => path === '/api/holds/Hold1/preview')).toHaveLength(1);
    expect(requests.filter(path => /^\/api\/holds\/[^/]+\/model$/.test(path))).toEqual([]);

    releaseTerminal();
    await expect(hold1.locator('.collider-state')).toHaveText(terminal, { timeout: 15_000 });
    if (terminal === 'Ready') await expect(use).toBeEnabled();
    else await expect(use).toBeDisabled();
    await expect(hold1.getByAltText('Anteprima Hold1')).toBeVisible();

    // Osserva piu intervalli normali dopo lo stato terminale, senza alterare i timer dell'app.
    await page.waitForTimeout(3500);
    expect(statusRequests).toBe(2);
    expect(navigations).toBe(1);
    expect(requests.filter(path => path === '/api/holds')).toHaveLength(1);
    expect(requests.filter(path => path === '/api/holds/Hold1/preview')).toHaveLength(1);
    expect(requests.filter(path => /^\/api\/holds\/[^/]+\/model$/.test(path))).toEqual([]);

    if (terminal === 'Ready') {
      await use.click();
      await expect(hold1).toHaveCount(0);
      await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
      expect(requests.filter(path => path === '/api/holds/Hold1/model')).toHaveLength(1);
      expect(requests.filter(path => path === '/api/holds/Hold1/collider')).toHaveLength(1);
      await page.getByRole('toolbar', { name: 'Azioni presa selezionata' }).getByRole('button', { name: 'Rimuovi' }).click();
      await expect(hold1).toBeVisible();
      await expect(use).toBeEnabled();
      await expect(hold1.getByAltText('Anteprima Hold1')).toBeVisible();
      expect(requests.filter(path => path === '/api/holds/Hold1/preview')).toHaveLength(1);
      expect(requests.filter(path => path === '/api/holds')).toHaveLength(1);
      expect(statusRequests).toBe(2);
      expect(navigations).toBe(1);
    }
  });
}
