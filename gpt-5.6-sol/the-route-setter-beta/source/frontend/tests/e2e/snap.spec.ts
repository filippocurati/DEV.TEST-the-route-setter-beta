import { expect, test, type Page } from '@playwright/test';

test.describe('snap e post-snap', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
    await page.locator('[data-hold-id="Hold1"]').getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText('Hold1 aggiunta alla scena.', { timeout: 120_000 });
  });

  test('non esegue snap oltre 5 cm e aggancia entrando nella soglia', async ({ page }) => {
    const initial = await state(page);
    expect(initial.holdStates.Hold1.attachment).toBe('pre-snap');
    expect(initial.selectedHoldPosition![2] - initial.wallFrontReference[2]).toBeCloseTo(2, 4);

    await page.getByRole('button', { name: 'Avvicina presa alla parete' }).click();
    const afterSingleStep = await state(page);
    expect(afterSingleStep.holdStates.Hold1.attachment).toBe('pre-snap');
    expect(initial.selectedHoldPosition![2] - afterSingleStep.selectedHoldPosition![2]).toBeCloseTo(0.01, 4);

    await holdUntilAttached(page);

    const snapped = await state(page);
    expect(snapped.holdStates.Hold1.attachment).toBe('post-snap');
    expect(snapped.holdStates.Hold1.contactPoint).not.toBeNull();
    expect(distance(snapped.selectedHoldPosition!, snapped.holdStates.Hold1.contactPoint!)).toBeLessThan(1e-4);
  });

  test('mantiene movimento tangenziale, rotazione normale e sgancio controllato', async ({ page }) => {
    const initialRotation = (await state(page)).selectedHoldRotation!;
    await holdUntilAttached(page);
    const snapped = await state(page);

    await page.getByRole('button', { name: 'Avvicina presa alla parete' }).click();
    const afterNoOp = await state(page);
    expect(distance(snapped.selectedHoldPosition!, afterNoOp.selectedHoldPosition!)).toBeLessThan(1e-6);

    await page.getByRole('button', { name: 'Sposta presa su' }).click();
    const afterTangent = await state(page);
    expect(distance(afterNoOp.selectedHoldPosition!, afterTangent.selectedHoldPosition!)).toBeCloseTo(0.01, 3);
    expect(afterTangent.holdStates.Hold1.attachment).toBe('post-snap');

    await page.getByRole('button', { name: 'Ruota presa in senso orario' }).click();
    const afterRotation = await state(page);
    expect(quaternionAngle(afterTangent.selectedHoldRotation!, afterRotation.selectedHoldRotation!)).toBeCloseTo(Math.PI / 180, 4);

    await page.getByRole('button', { name: 'Allontana presa dalla parete' }).click();
    const detached = await state(page);
    expect(detached.holdStates.Hold1.attachment).toBe('pre-snap');
    expect(quaternionAngle(initialRotation, detached.selectedHoldRotation!)).toBeLessThan(1e-5);
    expect(distance(detached.selectedHoldPosition!, afterRotation.holdStates.Hold1.contactPoint!)).toBeCloseTo(0.25, 3);
  });
});

/** Invia passi UI reali in batch finché la macchina a stati segnala post-snap. */
async function holdUntilAttached(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Avvicina presa alla parete' });
  await button.evaluate((element) => {
    for (let index = 0; index < 210; index += 1) {
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
      if (window.__ROUTE_SETTER_SCENE__?.holdStates.Hold1.attachment === 'post-snap') break;
    }
  });
  await expect.poll(async () => (await state(page)).holdStates.Hold1.attachment, {
    timeout: 60_000,
  }).toBe('post-snap');
}

async function state(page: Page) {
  return page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function quaternionAngle(a: readonly number[], b: readonly number[]): number {
  const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(dot);
}
