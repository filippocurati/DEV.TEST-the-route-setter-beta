import { expect, test, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page), 'Nessuna eccezione JavaScript durante le interazioni').toEqual([]);
});

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
    await page.locator('[data-move="up"]').click();
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
    const beforeMove = await sceneState(page);
    const moveStarted = Date.now();
    for (let index = 0; index < 20; index += 1) {
      await page.locator('[data-move="up"]').click();
    }
    // Include il costo di input reale, actionability e round-trip Playwright.
    expect(Date.now() - moveStarted).toBeLessThan(15_000);
    expect((await sceneState(page)).selectedHoldPosition).not.toEqual(beforeMove.selectedHoldPosition);

    await page.keyboard.press('Escape');
    await clickHold(page, 'Hold1');
    await popup.getByRole('button', { name: 'Ruota' }).click();
    const beforeRotate = await sceneState(page);
    const rotateStarted = Date.now();
    for (let index = 0; index < 20; index += 1) {
      await page.locator('[data-rotate="clockwise"]').click();
    }
    expect(Date.now() - rotateStarted).toBeLessThan(15_000);
    expect(quaternionAngle(beforeRotate.selectedHoldRotation!, (await sceneState(page)).selectedHoldRotation!))
      .toBeCloseTo(20 * Math.PI / 180, 4);
  });

  test('mostra shadow durante drag movimento e committa soltanto al rilascio', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Sposta' }).click();
    const handle = page.locator('[data-move="up"]');
    const box = await handle.boundingBox();
    const before = await sceneState(page);
    const unexpectedRequests: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/') || path.endsWith('.png') || path.endsWith('.glb')) unexpectedRequests.push(path);
    });
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 - 80, { steps: 3 });
    const preview = await sceneState(page);

    expect(preview.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(preview.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    expect(preview.holdStates.Hold1.contactPoint).toEqual(before.holdStates.Hold1.contactPoint);
    expect(preview.holdStates.Hold1.attachmentNormal).toEqual(before.holdStates.Hold1.attachmentNormal);
    expect(preview.holdStates.Hold1.twistRadians).toBe(before.holdStates.Hold1.twistRadians);
    expect(preview.poseValidationCount).toBe(before.poseValidationCount);
    expect(preview.dragPreview?.kind).toBe('move');
    expect(preview.dragCandidateEndpointAvailable).toBe(true);
    expect(preview.dragPreview!.requested).toEqual(preview.dragPreview!.candidate);
    expect(preview.dragPreview!.requested.x).toBeCloseTo(preview.dragPreview!.start.x, 5);
    expect(preview.previewObjectCount).toBe(1);
    expect(preview.rigidBodyCount).toBe(before.rigidBodyCount);
    expect(preview.colliderCount).toBe(before.colliderCount);
    expect(unexpectedRequests).toEqual([]);
    await expect(page.locator('[data-drag-indicator]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeDisabled();

    await page.mouse.up();
    const after = await sceneState(page);
    expect(after.poseValidationCount).toBe(before.poseValidationCount + 1);
    expect(after.dragPreview).toBeNull();
    expect(after.previewObjectCount).toBe(0);
    expect(after.selectedHoldPosition).not.toEqual(before.selectedHoldPosition);
    expect(after.contactFeatureId).toBe(preview.dragCandidateFeatureId);
    expect(unexpectedRequests).toEqual([]);
    await expect(page.getByRole('button', { name: 'Genera immagine' })).toBeEnabled();
  });

  test('nasconde e ripristina la shadow e annulla il rilascio fuori viewport senza superficie', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Sposta' }).click();
    const box = (await page.locator('[data-move="up"]').boundingBox())!;
    const canvasBox = (await page.locator('[data-scene-canvas]').boundingBox())!;
    const before = await sceneState(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 60, { steps: 3 });
    await expect.poll(async () => (await sceneState(page)).dragCandidateEndpointAvailable).toBe(true);
    expect((await sceneState(page)).dragShadowVisible).toBe(true);

    // Il pointer capture della freccia conserva il gesto anche fuori viewport.
    await page.mouse.move(x, -canvasBox.height * 2);
    await expect.poll(async () => (await sceneState(page)).lastActionResult?.reason).toBe('no-surface');
    const missed = await sceneState(page);
    expect(missed.lastActionResult?.status).toBe('surface-limit');
    expect(missed.dragCandidateEndpointAvailable).toBe(false);
    expect(missed.dragShadowVisible).toBe(false);
    expect(missed.poseValidationCount).toBe(before.poseValidationCount);

    await page.mouse.move(x, y - 60);
    await expect.poll(async () => (await sceneState(page)).dragShadowVisible).toBe(true);
    const recovered = await sceneState(page);
    expect(recovered.dragCandidateEndpointAvailable).toBe(true);
    expect(recovered.lastActionResult?.status).toBe('previewing');
    expect(recovered.lastActionResult?.reason).toBeUndefined();
    await page.mouse.move(x, -canvasBox.height * 2);
    await expect.poll(async () => (await sceneState(page)).dragCandidateEndpointAvailable).toBe(false);
    await page.mouse.up();
    const after = await sceneState(page);
    expect(after.lastActionResult).toMatchObject({ status: 'invalid-endpoint', reason: 'no-surface' });
    expect(after.lastActionResult?.message).not.toMatch(/collision/i);
    expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(after.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    expect(after.holdStates.Hold1).toEqual(before.holdStates.Hold1);
    expect(after.contactFeatureId).toBe(before.contactFeatureId);
    expect(after.poseValidationCount).toBe(before.poseValidationCount);
    expect(after.dragPreview).toBeNull();
    expect(after.dragCandidateFeatureId).toBeNull();
    expect(after.dragCandidateEndpointAvailable).toBe(false);
    expect(after.dragShadowVisible).toBe(false);
    expect(after.previewObjectCount).toBe(0);
    expect(after.orbitControlsEnabled).toBe(true);
  });

  for (const mode of ['Sposta', 'Ruota'] as const) {
    test(`distingue no-change da collisione nel drag ${mode}`, async ({ page }) => {
      await attachAtWallCenter(page);
      await page.getByRole('button', { name: mode }).click();
      const handle = page.locator(mode === 'Sposta' ? '[data-move="up"]' : '[data-rotate="clockwise"]');
      const box = (await handle.boundingBox())!;
      const before = await sceneState(page);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 60, { steps: 3 });
      await expect.poll(async () => (await sceneState(page)).dragPreview?.kind)
        .toBe(mode === 'Sposta' ? 'move' : 'rotate');
      await page.mouse.move(x, y, { steps: 3 });
      await page.mouse.up();
      const after = await sceneState(page);
      expect(after.lastActionResult).toMatchObject({ status: 'cancelled', reason: 'no-change' });
      expect(after.lastActionResult?.message).not.toMatch(/collision/i);
      expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
      expect(after.selectedHoldRotation).toEqual(before.selectedHoldRotation);
      expect(after.holdStates.Hold1).toEqual(before.holdStates.Hold1);
      expect(after.contactFeatureId).toBe(before.contactFeatureId);
      expect(after.poseValidationCount).toBe(before.poseValidationCount);
      expect(after.dragPreview).toBeNull();
      expect(after.previewObjectCount).toBe(0);
      expect(after.orbitControlsEnabled).toBe(true);
    });
  }

  test('mantiene reason e posa quando aggancio e drag collidono con una presa', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.locator('[data-hold-id="Hold2"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold2 aggiunta alla scena.', { timeout: 120_000 });
    const before = await sceneState(page);
    await page.getByRole('button', { name: 'Aggancia' }).click();
    const box = (await page.locator('[data-scene-canvas]').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const after = await sceneState(page);
    expect(after.lastActionResult).toMatchObject({ status: 'invalid-target', reason: 'hold-collision' });
    expect(after.lastActionResult?.message).toContain('altra presa');
    expect(after.interactionMode).toBe('attach-targeting');
    expect(after.holdStates.Hold2.physicalState).toBe('detached');
    expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(after.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    expect(after.contactFeatureId).toBeNull();
    expect(after.targetVisible).toBe(true);

    // Un nuovo punto conserva il fallimento precedente finche non viene confermato.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80);
    await expect.poll(async () => (await sceneState(page)).lastActionResult?.reason).toBe('hold-collision');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 80);
    await expect.poll(async () => (await sceneState(page)).holdStates.Hold2.physicalState).toBe('attached');
    expect((await sceneState(page)).lastActionResult?.reason).toBeUndefined();
    // Dopo il commit su pointerup, il click sul punto di contatto puo deselezionare la mesh.
    await clickHold(page, 'Hold2');
    await page.getByRole('button', { name: 'Sposta' }).click();
    const handleBox = (await page.locator('[data-move="down"]').boundingBox())!;
    const attached = await sceneState(page);
    const x = handleBox.x + handleBox.width / 2;
    const y = handleBox.y + handleBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 80, { steps: 3 });
    await expect.poll(async () => (await sceneState(page)).dragPreview?.kind).toBe('move');
    expect((await sceneState(page)).poseValidationCount).toBe(attached.poseValidationCount);
    await page.mouse.up();
    const rejected = await sceneState(page);
    expect(rejected.lastActionResult).toMatchObject({ status: 'invalid-endpoint', reason: 'hold-collision' });
    expect(rejected.selectedHoldPosition).toEqual(attached.selectedHoldPosition);
    expect(rejected.selectedHoldRotation).toEqual(attached.selectedHoldRotation);
    expect(rejected.holdStates.Hold2).toEqual(attached.holdStates.Hold2);
    expect(rejected.contactFeatureId).toBe(attached.contactFeatureId);
    expect(rejected.poseValidationCount).toBe(attached.poseValidationCount + 1);
    expect(rejected.dragPreview).toBeNull();
    expect(rejected.previewObjectCount).toBe(0);
    expect(rejected.orbitControlsEnabled).toBe(true);
  });

  test('pointercancel annulla il drag e rilascia preview e camera', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Sposta' }).click();
    const handle = page.locator('[data-move="up"]');
    const box = await handle.boundingBox();
    const before = await sceneState(page);
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y - 60, { steps: 3 });
    await expect.poll(async () => (await sceneState(page)).previewObjectCount).toBe(1);
    await handle.dispatchEvent('pointercancel', { pointerType: 'mouse', pointerId: 1 });
    await page.mouse.up();

    const after = await sceneState(page);
    expect(after.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(after.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    expect(after.previewObjectCount).toBe(0);
    expect(after.dragPreview).toBeNull();
    expect(after.orbitControlsEnabled).toBe(true);
    expect(after.poseValidationCount).toBe(before.poseValidationCount);
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

  test('il drag globale adatta la shadow alla normale della superficie visibile', async ({ page }) => {
    await attachAtWallCenter(page);
    await page.getByRole('button', { name: 'Sposta' }).click();
    const canvas = page.locator('[data-scene-canvas]');
    const canvasBox = await canvas.boundingBox();
    const before = await sceneState(page);
    const initialNormal = before.holdStates.Hold1.attachmentNormal!;
    const [x, y] = before.holdScreenPositions.Hold1;
    const startX = canvasBox!.x + ((x + 1) / 2) * canvasBox!.width;
    const startY = canvasBox!.y + ((1 - y) / 2) * canvasBox!.height;
    let preview: Awaited<ReturnType<typeof sceneState>> | null = null;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (const xf of [0.15, 0.22, 0.3, 0.38, 0.62, 0.7, 0.78, 0.85]) {
      for (const yf of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        await page.mouse.move(canvasBox!.x + canvasBox!.width * xf, canvasBox!.y + canvasBox!.height * yf);
        const state = await sceneState(page);
        if (state.dragCandidateEndpointAvailable && state.dragCandidateNormal
          && vectorAngle(initialNormal, state.dragCandidateNormal) > Math.PI / 36) {
          preview = state;
          break;
        }
      }
      if (preview) break;
    }
    expect(preview).not.toBeNull();
    expect(preview!.selectedHoldPosition).toEqual(before.selectedHoldPosition);
    expect(preview!.dragPreview!.candidate.x).toBeCloseTo(preview!.dragPreview!.requested.x, 3);
    expect(preview!.dragPreview!.candidate.y).toBeCloseTo(preview!.dragPreview!.requested.y, 3);
    expect(preview!.lastActionResult?.status).toBe('previewing');
    expect(preview!.dragCandidateFeatureId).not.toBeNull();
    expect(preview!.dragCandidateFeatureId).not.toBe(before.contactFeatureId);
    expect(preview!.contactFeatureId).toBe(before.contactFeatureId);
    expect(preview!.poseValidationCount).toBe(before.poseValidationCount);
    await page.mouse.up();
    const after = await sceneState(page);
    expect(after.lastActionResult?.status).toBe('committed');
    expect(after.contactFeatureId).toBe(preview!.dragCandidateFeatureId);
    expect(vectorAngle(initialNormal, after.holdStates.Hold1.attachmentNormal!)).toBeGreaterThan(Math.PI / 36);
    const rotationBefore = after.selectedHoldRotation!;
    await page.getByRole('button', { name: 'Ruota' }).click();
    await page.locator('[data-rotate="clockwise"]').click();
    expect(quaternionAngle(rotationBefore, (await sceneState(page)).selectedHoldRotation!)).toBeCloseTo(Math.PI / 180, 4);
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

function vectorAngle(a: readonly number[], b: readonly number[]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const lengthA = Math.hypot(...a);
  const lengthB = Math.hypot(...b);
  return Math.acos(Math.max(-1, Math.min(1, dot / (lengthA * lengthB))));
}
