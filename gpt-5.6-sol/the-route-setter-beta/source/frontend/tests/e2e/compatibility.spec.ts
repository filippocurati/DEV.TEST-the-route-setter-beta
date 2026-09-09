import { expect, test } from '@playwright/test';
import { classifyRenderer, readBrowserTelemetry } from '../../scripts/con07-tooling';

test('CON07 compatibility: WebGL, real selection, move/rotation input and camera freeze', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?performance=1');
  await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
  const runtime = await page.evaluate(readBrowserTelemetry);
  await testInfo.attach('con07-compatibility-runtime.json', {
    body: JSON.stringify({ project: testInfo.project.name, version: browser.version(), runtime,
      rendererClass: classifyRenderer(runtime.webgl?.renderer ?? null), certified: false }, null, 2),
    contentType: 'application/json',
  });
  // Compatibility is functional, not a hardware performance certification.
  expect(runtime.webgl).not.toBeNull();
  expect(runtime.webgl?.contextLost).toBe(false);
  await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
  await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Aggancia', exact: true }).click();
  const canvas = (await page.locator('[data-scene-canvas]').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.holdStates.Hold1.physicalState)).toBe('attached');
  await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.start({ animateCamera: false }));

  for (const mode of ['Sposta', 'Ruota'] as const) {
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.selectedHoldId)).toBeNull();
    const [x, y] = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.holdScreenPositions.Hold1);
    await page.mouse.click(canvas.x + (x + 1) / 2 * canvas.width, canvas.y + (1 - y) / 2 * canvas.height);
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.selectedHoldId)).toBe('Hold1');
    await page.getByRole('button', { name: mode, exact: true }).click();
    const box = (await page.locator(mode === 'Sposta' ? '[data-move="up"]' : '[data-rotate="clockwise"]').boundingBox())!;
    const before = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + (mode === 'Sposta' ? -24 : 24), { steps: 8 });
      await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.dragPreview?.kind)).toBe(mode === 'Sposta' ? 'move' : 'rotate');
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(100);
      const during = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
      expect(during.orbitControlsEnabled).toBe(false);
      expect(during.cameraPosition).toEqual(before.cameraPosition);
      expect(during.cameraQuaternion).toEqual(before.cameraQuaternion);
      expect(during.controlsTarget).toEqual(before.controlsTarget);
      expect(during.cameraZoom).toBe(before.cameraZoom);
      expect(during.selectedHoldPosition).toEqual(before.selectedHoldPosition);
      expect(during.selectedHoldRotation).toEqual(before.selectedHoldRotation);
    } finally {
      await page.mouse.up();
    }
    await expect.poll(() => page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.lastActionResult?.status)).toBe('committed');
    const after = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
    expect(after.poseValidationCount).toBe(before.poseValidationCount + 1);
    expect(after.orbitControlsEnabled).toBe(true);
    expect(after.dragPreview).toBeNull();
    expect(mode === 'Sposta' ? after.selectedHoldPosition : after.selectedHoldRotation)
      .not.toEqual(mode === 'Sposta' ? before.selectedHoldPosition : before.selectedHoldRotation);
  }
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const beforeStop = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
  const telemetry = await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.stop());
  expect(telemetry.active).toBe(false);
  expect(telemetry.endpointDurations).toHaveLength(2);
  expect(telemetry.renderTimestamps.length).toBeGreaterThan(0);
  const afterStop = await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
  expect(afterStop.cameraPosition).toEqual(beforeStop.cameraPosition);
  expect(afterStop.cameraQuaternion).toEqual(beforeStop.cameraQuaternion);
  await page.getByRole('button', { name: 'Rimuovi', exact: true }).click();
  await expect(page.locator('[data-hold-id="Hold1"]')).toBeVisible();
  expect(await page.evaluate(() => window.__ROUTE_SETTER_SCENE__!.holdInstanceIds)).toEqual([]);
  expect(errors).toEqual([]);
});
