import { expect, test, type Page } from '@playwright/test';

test.describe('selezione e comandi hold', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
    await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
    await expect.poll(async () => (await sceneState(page)).selectedHoldId).toBe('Hold1');
  });

  test('seleziona con raycast, evidenzia e limita i comandi alla selezionata', async ({ page }) => {
    const canvas = page.locator('[data-scene-canvas]');
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + 5, box!.y + 5);
    expect((await sceneState(page)).selectedHoldId).toBeNull();

    await clickHold(page, 'Hold1');
    const selectedState = await sceneState(page);
    expect(selectedState.selectedHoldId, JSON.stringify({
      ids: selectedState.holdInstanceIds,
      positions: selectedState.holdScreenPositions,
    })).toBe('Hold1');
    await expect(page.getByRole('button', { name: 'Sposta presa su' })).toBeEnabled();

    await page.mouse.click(box!.x + 5, box!.y + 5);

    expect((await sceneState(page)).selectedHoldId).toBeNull();
    await expect(page.getByRole('button', { name: 'Sposta presa su' })).toBeDisabled();
    await page.keyboard.press('ArrowUp');
    expect((await sceneState(page)).selectedHoldPosition).toBeNull();
  });

  test('applica 1 cm e 1 grado con equivalenza tra UI e tastiera', async ({ page }) => {
    await clickHold(page, 'Hold1');
    const initial = await sceneState(page);

    await page.getByRole('button', { name: 'Sposta presa su' }).click();
    const afterUiMove = await sceneState(page);
    const uiDistance = distance(initial.selectedHoldPosition!, afterUiMove.selectedHoldPosition!);
    expect(uiDistance).toBeCloseTo(0.01, 4);

    await page.keyboard.press('ArrowUp');
    const afterKeyboardMove = await sceneState(page);
    const keyboardDistance = distance(afterUiMove.selectedHoldPosition!, afterKeyboardMove.selectedHoldPosition!);
    expect(keyboardDistance).toBeCloseTo(uiDistance, 4);

    const beforeRotation = afterKeyboardMove.selectedHoldRotation!;
    await page.getByRole('button', { name: 'Ruota presa in senso orario' }).click();
    const afterUiRotation = (await sceneState(page)).selectedHoldRotation!;
    await page.keyboard.press('KeyE');
    const afterKeyboardRotation = (await sceneState(page)).selectedHoldRotation!;
    const uiAngle = quaternionAngle(beforeRotation, afterUiRotation);
    const keyboardAngle = quaternionAngle(afterUiRotation, afterKeyboardRotation);
    expect(uiAngle).toBeCloseTo(Math.PI / 180, 4);
    expect(keyboardAngle).toBeCloseTo(uiAngle, 4);
  });

  test('ripete il comando durante la pressione continua', async ({ page }) => {
    await clickHold(page, 'Hold1');
    const button = page.getByRole('button', { name: 'Sposta presa a destra' });
    const before = (await sceneState(page)).selectedHoldPosition!;
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });

    await button.dispatchEvent('mousedown', { button: 0 });
    await page.waitForTimeout(3_000);
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup')));
    const after = (await sceneState(page)).selectedHoldPosition!;

    expect(distance(before, after)).toBeGreaterThan(0.019);
    expect(apiRequests).toEqual([]);
  });

  test('applica avanti e indietro lungo la normale con shortcut equivalenti', async ({ page }) => {
    await clickHold(page, 'Hold1');
    const initial = await sceneState(page);

    await page.getByRole('button', { name: 'Avvicina presa alla parete' }).click();
    const afterUiForward = await sceneState(page);
    expect(initial.selectedHoldPosition![2] - afterUiForward.selectedHoldPosition![2]).toBeCloseTo(0.01, 4);

    await page.keyboard.press('Shift+ArrowUp');
    const afterKeyboardForward = await sceneState(page);
    expect(afterUiForward.selectedHoldPosition![2] - afterKeyboardForward.selectedHoldPosition![2]).toBeCloseTo(0.01, 4);

    await page.getByRole('button', { name: 'Allontana presa dalla parete' }).click();
    const afterUiBackward = await sceneState(page);
    expect(afterUiBackward.selectedHoldPosition![2] - afterKeyboardForward.selectedHoldPosition![2]).toBeCloseTo(0.01, 4);

    await page.keyboard.press('Shift+ArrowDown');
    const afterKeyboardBackward = await sceneState(page);
    expect(afterKeyboardBackward.selectedHoldPosition![2]).toBeCloseTo(initial.selectedHoldPosition![2], 4);
    expect(afterKeyboardBackward.holdStates.Hold1.attachment).toBe('pre-snap');
  });

  test('ripete avanti durante la pressione continua', async ({ page }) => {
    await clickHold(page, 'Hold1');
    const button = page.getByRole('button', { name: 'Avvicina presa alla parete' });
    const before = (await sceneState(page)).selectedHoldPosition!;

    await button.dispatchEvent('mousedown', { button: 0 });
    await page.waitForTimeout(5_000);
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup')));
    const after = (await sceneState(page)).selectedHoldPosition!;

    expect(before[2] - after[2]).toBeGreaterThan(0.019);
  });

  test('rimuove solo la presa selezionata e libera corpo e collider', async ({ page }) => {
    await page.locator('[data-hold-id="Hold2"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold2 aggiunta alla scena.', { timeout: 120_000 });
    await clickHold(page, 'Hold1');
    const before = await sceneState(page);
    expect(before.holdInstanceIds).toEqual(['Hold1', 'Hold2']);

    await page.getByRole('button', { name: 'Rimuovi presa' }).click();

    await expect(page.locator('[data-hold-id="Hold1"]')).toBeVisible();
    const after = await sceneState(page);
    expect(after.holdInstanceIds).toEqual(['Hold2']);
    expect(after.selectedHoldId).toBeNull();
    expect(after.rigidBodyCount).toBe(before.rigidBodyCount - 1);
    expect(after.colliderCount).toBe(before.colliderCount - 1);
    expect(after.selectedHoldBodyValid).toBe(false);
  });

});

/** Legge lo stato diagnostico aggiornato dalla scena. */
async function sceneState(page: Page) {
  return page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
}

/** Converte la coordinata normalizzata esposta dalla scena in un click canvas reale. */
async function clickHold(page: Page, id: string): Promise<void> {
  const canvas = page.locator('[data-scene-canvas]');
  const box = await canvas.boundingBox();
  const state = await sceneState(page);
  const [x, y] = state.holdScreenPositions[id];
  const centerX = box!.x + ((x + 1) / 2) * box!.width;
  const centerY = box!.y + ((1 - y) / 2) * box!.height;
  for (const offsetY of [0, -10, 10, -20, 20, -35, 35]) {
    for (const offsetX of [0, -10, 10, -20, 20, -35, 35]) {
      const clickX = centerX + offsetX;
      const clickY = centerY + offsetY;
      if (clickX <= box!.x || clickX >= box!.x + box!.width
        || clickY <= box!.y || clickY >= box!.y + box!.height) continue;
      await page.mouse.click(clickX, clickY);
      if ((await sceneState(page)).selectedHoldId === id) return;
    }
  }
}

/** Calcola la distanza euclidea tra due posizioni XYZ. */
function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Calcola l'angolo minimo tra due quaternioni normalizzati. */
function quaternionAngle(a: readonly number[], b: readonly number[]): number {
  const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(dot);
}
