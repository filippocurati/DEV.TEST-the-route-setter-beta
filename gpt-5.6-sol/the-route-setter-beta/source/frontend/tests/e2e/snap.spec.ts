import { expect, test, type Page } from '@playwright/test';

test.describe('aggancio contestuale 9UX', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
    await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  });

  test('aggancia direttamente al target e riapre il popup attached', async ({ page }) => {
    const popup = page.getByRole('toolbar', { name: 'Azioni presa selezionata' });
    await expect(popup.getByRole('button', { name: 'Aggancia' })).toBeEnabled();
    await expect(popup.getByRole('button', { name: 'Sgancia' })).toBeDisabled();
    await attachAtWallCenter(page);
    const state = await sceneState(page);
    expect(state.holdStates.Hold1.physicalState).toBe('attached');
    expect(state.holdStates.Hold1.contactPoint).not.toBeNull();
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Sgancia' })).toBeEnabled();
  });

  test('annulla il targeting con Escape deselezionando senza cambiare posa', async ({ page }) => {
    const before = await sceneState(page);
    await page.getByRole('button', { name: 'Aggancia' }).click();
    await expect.poll(async () => (await sceneState(page)).interactionMode).toBe('attach-targeting');
    await page.keyboard.press('Escape');
    const after = await sceneState(page);
    expect(after.interactionMode).toBe('idle');
    expect(after.selectedHoldId).toBeNull();
    expect(after.previewObjectCount).toBe(0);
    await expect(page.getByRole('toolbar', { name: 'Azioni presa selezionata' })).toBeHidden();
    await clickHold(page, 'Hold1');
    expect((await sceneState(page)).selectedHoldPosition).toEqual(before.selectedHoldPosition);
  });

  test('sgancia cercando una posa valida da cinquanta centimetri', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Ruota' }).click();
    await page.locator('[data-rotate="clockwise"]').click();
    const attached = await sceneState(page);
    await page.getByRole('button', { name: 'Sgancia' }).click();
    const detached = await sceneState(page);
    expect(detached.holdStates.Hold1.physicalState).toBe('detached');
    expect(detached.holdStates.Hold1.contactPoint).toBeNull();
    expect(distance(detached.selectedHoldPosition!, attached.selectedHoldPosition!)).toBeGreaterThanOrEqual(0.49);
    await page.getByRole('button', { name: 'Aggancia' }).click();
    const canvas = page.locator('[data-scene-canvas]');
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    const reattached = await sceneState(page);
    expect(quaternionAngle(attached.selectedHoldRotation!, reattached.selectedHoldRotation!)).toBeGreaterThan(0.01);
  });

  test('mantiene il targeting e mostra rosso quando la posa collide con un’altra presa', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.locator('[data-hold-id="Hold2"]').getByRole('button', { name: 'Utilizza' }).click();
    await page.getByRole('button', { name: 'Aggancia' }).click();
    const canvas = page.locator('[data-scene-canvas]');
    const box = await canvas.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    const before = await sceneState(page);
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    const after = await sceneState(page);

    expect(after.interactionMode).toBe('attach-targeting');
    expect(after.holdStates.Hold2.physicalState).toBe('detached');
    expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(after.lastActionResult?.status).toBe('invalid-target');
  });

  test('riserva il drag sinistro al targeting e mantiene lo zoom della camera', async ({ page }) => {
    await page.getByRole('button', { name: 'Aggancia' }).click();
    const canvas = page.locator('[data-scene-canvas]');
    const box = await canvas.boundingBox();
    const before = await sceneState(page);
    await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.55);
    await page.mouse.up({ button: 'left' });
    const afterLeftDrag = await sceneState(page);
    expect(afterLeftDrag.cameraPosition).toEqual(before.cameraPosition);
    expect(afterLeftDrag.holdStates.Hold1.physicalState).toBe('detached');

    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await sceneState(page)).cameraPosition).not.toEqual(before.cameraPosition);
  });

  test('orienta il target secondo la superficie inclinata', async ({ page }) => {
    await page.getByRole('button', { name: 'Aggancia' }).click();
    const canvas = page.locator('[data-scene-canvas]');
    const box = await canvas.boundingBox();
    let found = false;
    for (const x of [0.15, 0.22, 0.3, 0.38]) {
      for (const y of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        await page.mouse.move(box!.x + box!.width * x, box!.y + box!.height * y);
        const state = await sceneState(page);
        if (state.previewObjectCount === 1 && state.targetNormal) {
          if (Math.abs(state.targetNormal[1]) > 0.05 || Math.abs(state.targetNormal[0]) > 0.05) {
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
    expect((await sceneState(page)).previewObjectCount).toBe(1);
  });
});

async function attachAtWallCenter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Aggancia' }).click();
  const canvas = page.locator('[data-scene-canvas]');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(async () => (await sceneState(page)).previewObjectCount).toBe(1);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(async () => (await sceneState(page)).holdStates.Hold1.physicalState).toBe('attached');
}

async function clickHold(page: Page, id: string): Promise<void> {
  const canvas = page.locator('[data-scene-canvas]');
  const box = await canvas.boundingBox();
  const [x, y] = (await sceneState(page)).holdScreenPositions[id];
  await page.mouse.click(
    box!.x + ((x + 1) / 2) * box!.width,
    box!.y + ((1 - y) / 2) * box!.height,
  );
  await expect.poll(async () => (await sceneState(page)).selectedHoldId).toBe(id);
}

async function sceneState(page: Page) {
  return page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function quaternionAngle(a: readonly number[], b: readonly number[]): number {
  const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(dot);
}
