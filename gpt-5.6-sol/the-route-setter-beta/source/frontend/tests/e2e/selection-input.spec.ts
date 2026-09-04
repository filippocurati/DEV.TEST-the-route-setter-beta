import { expect, test, type Page } from '@playwright/test';

test.describe('selezione e comandi contestuali 9UX', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
    await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  });

  test('mostra popup completo e abilita le azioni secondo lo stato', async ({ page }) => {
    const popup = page.getByRole('toolbar', { name: 'Azioni presa selezionata' });
    await expect(popup).toBeVisible();
    for (const name of ['Dettagli', 'Aggancia', 'Sgancia', 'Ruota', 'Sposta', 'Rimuovi']) {
      await expect(popup.getByRole('button', { name })).toBeVisible();
    }
    await expect(popup.getByRole('button', { name: 'Aggancia' })).toBeEnabled();
    await expect(popup.getByRole('button', { name: 'Sgancia' })).toBeDisabled();
    await expect(popup.getByRole('button', { name: 'Ruota' })).toBeDisabled();
    await expect(popup.getByRole('button', { name: 'Sposta' })).toBeDisabled();
  });

  test('apre dal popup lo stesso viewer dettagli 3D del catalogo', async ({ page }) => {
    const popup = page.getByRole('toolbar', { name: 'Azioni presa selezionata' });
    await popup.getByRole('button', { name: 'Dettagli' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Dettagli Hold1' })).toBeVisible();
    await expect(dialog.locator('[data-details-canvas]')).toBeVisible({ timeout: 60_000 });
    await dialog.getByRole('button', { name: 'Chiudi dettagli' }).click();
    await expect(dialog).toBeHidden();
    await expect(popup).toBeVisible();
  });

  test('le shortcut legacy non trasformano la presa', async ({ page }) => {
    const before = await sceneState(page);
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'Shift+ArrowUp', 'Shift+ArrowDown']) {
      await page.keyboard.press(key);
    }
    const after = await sceneState(page);
    expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(after.selectedHoldRotation).toEqual(before.selectedHoldRotation);
  });

  test('rimuove dal popup e libera corpo e collider', async ({ page }) => {
    const before = await sceneState(page);
    await page.getByRole('toolbar', { name: 'Azioni presa selezionata' }).getByRole('button', { name: 'Rimuovi' }).click();
    await expect(page.locator('[data-hold-id="Hold1"]')).toBeVisible();
    const after = await sceneState(page);
    expect(after.holdInstanceIds).toEqual([]);
    expect(after.selectedHoldId).toBeNull();
    expect(after.rigidBodyCount).toBe(before.rigidBodyCount - 1);
    expect(after.colliderCount).toBe(before.colliderCount - 1);
  });

  test('sposta e ruota tramite gizmo mouse e Escape deseleziona la presa', async ({ page }) => {
    await attachAtWallCenter(page);
    const popup = page.getByRole('toolbar', { name: 'Azioni presa selezionata' });
    const beforeMove = await sceneState(page);
    await popup.getByRole('button', { name: 'Sposta' }).click();
    await expect.poll(async () => (await sceneState(page)).interactionMode).toBe('moving');
    await page.locator('[data-move="up"]').dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 1, button: 0 });
    await page.locator('[data-move="up"]').dispatchEvent('pointerup', { pointerType: 'mouse', pointerId: 1, button: 0 });
    const afterMove = await sceneState(page);
    expect(distance(beforeMove.selectedHoldPosition!, afterMove.selectedHoldPosition!)).toBeCloseTo(0.01, 3);

    const canvas = page.locator('[data-scene-canvas]');
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + 5, box!.y + 5);
    expect((await sceneState(page)).interactionMode).toBe('moving');

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await sceneState(page)).selectedHoldId).toBeNull();
    await expect(popup).toBeHidden();
    await clickHold(page, 'Hold1');
    await popup.getByRole('button', { name: 'Ruota' }).click();
    const beforeRotate = (await sceneState(page)).selectedHoldRotation!;
    await page.locator('[data-rotate="clockwise"]').click();
    const afterRotate = (await sceneState(page)).selectedHoldRotation!;
    expect(quaternionAngle(beforeRotate, afterRotate)).toBeCloseTo(Math.PI / 180, 4);

    const beforeLegacyKeys = await sceneState(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('KeyE');
    const afterLegacyKeys = await sceneState(page);
    expect(afterLegacyKeys.selectedHoldPosition).toEqual(beforeLegacyKeys.selectedHoldPosition);
    expect(afterLegacyKeys.selectedHoldRotation).toEqual(afterRotate);
  });

  test('mantiene reattivi click ripetuti di movimento e rotazione', async ({ page }) => {
    await attachAtWallCenter(page);
    const popup = page.getByRole('toolbar', { name: 'Azioni presa selezionata' });
    await popup.getByRole('button', { name: 'Sposta' }).click();
    const moveElapsed = await page.locator('[data-move="up"]').evaluate((element) => {
      const started = performance.now();
      for (let index = 0; index < 20; index += 1) {
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: index + 1, pointerType: 'mouse', button: 0 }));
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: index + 1, pointerType: 'mouse', button: 0 }));
      }
      return performance.now() - started;
    });
    expect(moveElapsed).toBeLessThan(3_000);

    await page.keyboard.press('Escape');
    await clickHold(page, 'Hold1');
    await popup.getByRole('button', { name: 'Ruota' }).click();
    const rotateElapsed = await page.locator('[data-rotate="clockwise"]').evaluate((element) => {
      const started = performance.now();
      for (let index = 0; index < 20; index += 1) {
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: index + 101, pointerType: 'mouse', button: 0 }));
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: index + 101, pointerType: 'mouse', button: 0 }));
      }
      return performance.now() - started;
    });
    expect(rotateElapsed).toBeLessThan(3_000);
  });

  test('mostra shadow durante drag movimento e committa soltanto al rilascio', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Sposta' }).click();
    const handle = page.locator('[data-move="up"]');
    const box = await handle.boundingBox();
    const before = await sceneState(page);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 - 80, { steps: 3 });
    const preview = await sceneState(page);

    expect(preview.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(preview.dragPreview?.kind).toBe('move');
    expect(preview.previewObjectCount).toBe(1);
    expect(preview.rigidBodyCount).toBe(before.rigidBodyCount);
    expect(preview.colliderCount).toBe(before.colliderCount);
    expect(apiRequests).toEqual([]);
    await expect(page.locator('[data-drag-indicator]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeDisabled();

    await page.mouse.up();
    const after = await sceneState(page);
    expect(after.dragPreview).toBeNull();
    expect(after.previewObjectCount).toBe(0);
    expect(after.selectedHoldPosition).not.toEqual(before.selectedHoldPosition);
    await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeEnabled();
  });

  test('annulla drag rotazione con Escape senza mutare la posa reale', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Ruota' }).click();
    const handle = page.locator('[data-rotate="clockwise"]');
    const box = await handle.boundingBox();
    const before = await sceneState(page);
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 60, { steps: 3 });
    const preview = await sceneState(page);
    expect(preview.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    expect(preview.dragPreview?.kind).toBe('rotate');
    expect(preview.dragPreview!.angleDegrees).toBeLessThan(0);
    expect(preview.previewObjectCount).toBe(1);
    expect(preview.cameraPosition).toEqual(before.cameraPosition);
    expect(preview.orbitControlsEnabled).toBe(false);
    await page.keyboard.press('Escape');
    let after = await sceneState(page);
    expect(after.dragPreview).toBeNull();
    expect(after.previewObjectCount).toBe(0);
    expect(after.orbitControlsEnabled).toBe(true);
    expect(after.selectedHoldId).toBeNull();
    await expect(page.getByRole('toolbar', { name: 'Azioni presa selezionata' })).toBeHidden();
    await clickHold(page, 'Hold1');
    after = await sceneState(page);
    expect(after.selectedHoldRotation).toEqual(before.selectedHoldRotation);
  });

  test('committa la rotazione shadow soltanto al rilascio', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Ruota' }).click();
    const handle = page.locator('[data-rotate="clockwise"]');
    const box = await handle.boundingBox();
    const before = await sceneState(page);
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 45, { steps: 2 });
    const preview = await sceneState(page);
    expect(preview.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    expect(preview.dragPreview?.kind).toBe('rotate');
    expect(preview.previewObjectCount).toBe(1);
    await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeDisabled();
    await page.mouse.up();
    const after = await sceneState(page);
    expect(after.selectedHoldRotation).not.toEqual(before.selectedHoldRotation);
    expect(after.dragPreview).toBeNull();
    expect(after.previewObjectCount).toBe(0);
  });

  test('avvia il drag libero direttamente dalla presa in modalità Sposta', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Sposta' }).click();
    const canvas = page.locator('[data-scene-canvas]');
    const canvasBox = await canvas.boundingBox();
    const before = await sceneState(page);
    const [x, y] = before.holdScreenPositions.Hold1;
    const startX = canvasBox!.x + ((x + 1) / 2) * canvasBox!.width;
    const startY = canvasBox!.y + ((1 - y) / 2) * canvasBox!.height;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 65, { steps: 3 });
    const preview = await sceneState(page);
    expect(preview.dragPreview?.kind).toBe('move');
    expect(preview.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(Math.abs(preview.dragPreview!.requested.x - preview.dragPreview!.start.x)).toBeGreaterThan(4);
    expect(preview.dragPreview!.requested.y).toBeLessThan(preview.dragPreview!.start.y - 40);
    await page.mouse.up();
    const after = await sceneState(page);
    expect(after.dragPreview).toBeNull();
    expect(['committed', 'invalid-endpoint']).toContain(after.lastActionResult?.status);
  });

});

async function sceneState(page: Page) {
  return page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
}

async function attachAtWallCenter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Aggancia' }).click();
  const canvas = page.locator('[data-scene-canvas]');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
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

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function quaternionAngle(a: readonly number[], b: readonly number[]): number {
  const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(dot);
}
