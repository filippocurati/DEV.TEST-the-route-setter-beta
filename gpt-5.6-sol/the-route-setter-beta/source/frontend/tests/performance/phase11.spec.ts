import { expect, test, type Page } from '@playwright/test';

const environment = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const HOLD_COUNT = Number(environment?.PERF_HOLD_COUNT ?? 40);
const MEASUREMENT_MS = Number(environment?.PERF_DURATION_MS ?? 60_000);

test('40 hold restano interattive a 1920x1080 per 60 secondi', async ({ page }, testInfo) => {
  test.setTimeout(15 * 60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installResponsivenessObserver(page);
  await page.route(/\/api\/holds(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const source = await response.json() as Array<Record<string, unknown>>;
    expect(source.length).toBeGreaterThanOrEqual(2);
    const holds = Array.from({ length: HOLD_COUNT }, (_, index) => ({
      ...source[index % source.length],
      id: `BenchmarkHold${String(index + 1).padStart(2, '0')}`,
    }));
    await route.fulfill({ response, json: holds });
  });

  await page.goto('/?performance=1');
  await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
  await expect(page.locator('.hold-card')).toHaveCount(HOLD_COUNT);
  await page.evaluate(() => window.__PHASE11_RESPONSIVENESS__!.reset());
  const holdLoadDurations: number[] = [];

  for (let index = 1; index <= HOLD_COUNT; index += 1) {
    const id = `BenchmarkHold${String(index).padStart(2, '0')}`;
    const startedAt = performance.now();
    await page.locator(`[data-hold-id="${id}"]`).getByRole('button', { name: 'Utilizza' }).click();
    await expect(page.locator('[data-catalog-feedback]')).toHaveText(`${id} aggiunta alla scena.`, { timeout: 120_000 });
    holdLoadDurations.push(performance.now() - startedAt);
    if ((index % 10 === 0 || index === HOLD_COUNT) && environment?.PERF_VERBOSE === 'true') {
      console.log(`Caricate ${index}/${HOLD_COUNT} hold.`);
    }
  }

  const populated = await sceneState(page);
  expect(populated.holdInstanceIds).toHaveLength(HOLD_COUNT);
  expect(populated.rigidBodyCount).toBe(HOLD_COUNT + 1);
  expect(populated.colliderCount).toBe(HOLD_COUNT + 1);

  const loadingResponsiveness = await page.evaluate(() => window.__PHASE11_RESPONSIVENESS__!.reset());
  await selectHold(page, 'BenchmarkHold01');
  await attachSelectedAtWallCenter(page);
  const attachmentResponsiveness = await page.evaluate(() => window.__PHASE11_RESPONSIVENESS__!.reset());
  await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.start());
  await measureEndpointCommit(page);
  const telemetry = await page.evaluate(async (duration) => {
    const controller = window.__ROUTE_SETTER_PERFORMANCE__!;
    await new Promise((resolve) => setTimeout(resolve, duration));
    return controller.stop();
  }, MEASUREMENT_MS);
  const responsiveness = await page.evaluate(() => window.__PHASE11_RESPONSIVENESS__!.snapshot());
  const result = summarize(telemetry, responsiveness, loadingResponsiveness, attachmentResponsiveness, holdLoadDurations, populated, pageErrors);

  await testInfo.attach('phase-11-performance.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });

  expect(result.viewport).toEqual({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  expect(result.scene.holds).toBe(HOLD_COUNT);
  expect(result.measuredDurationMs).toBeGreaterThanOrEqual(MEASUREMENT_MS);
  expect(result.rendering.medianFps).toBeGreaterThanOrEqual(30);
  expect(result.responsiveness.maxLongTaskMs).toBeLessThanOrEqual(200);
  expect(result.responsiveness.p95HeartbeatDelayMs).toBeLessThanOrEqual(200);
  expect(result.loadingResponsiveness.maxLongTaskMs).toBeLessThanOrEqual(200);
  expect(result.loadingResponsiveness.p95HeartbeatDelayMs).toBeLessThanOrEqual(200);
  expect(result.attachmentResponsiveness.maxLongTaskMs).toBeLessThanOrEqual(200);
  expect(result.endpointLatency.count).toBeGreaterThanOrEqual(1);
  expect(result.endpointLatency.p50Ms).toBeLessThanOrEqual(50);
  expect(result.endpointLatency.maxMs).toBeLessThanOrEqual(100);
  expect(result.pageErrors).toEqual([]);
});

async function installResponsivenessObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const longTasks: number[] = [];
    const heartbeatDelays: number[] = [];
    let expected = performance.now() + 50;
    setInterval(() => {
      const now = performance.now();
      heartbeatDelays.push(Math.max(0, now - expected));
      expected = now + 50;
    }, 50);
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      new PerformanceObserver((list) => {
        longTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    }
    window.__PHASE11_RESPONSIVENESS__ = {
      snapshot: () => ({ longTasks: [...longTasks], heartbeatDelays: [...heartbeatDelays] }),
      reset: () => {
        const snapshot = { longTasks: [...longTasks], heartbeatDelays: [...heartbeatDelays] };
        longTasks.length = 0;
        heartbeatDelays.length = 0;
        expected = performance.now() + 50;
        return snapshot;
      },
    };
  });
}

async function attachSelectedAtWallCenter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Aggancia' }).click();
  const canvas = page.locator('[data-scene-canvas]');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(async () => (await sceneState(page)).interactionMode).toBe('idle');
}

async function selectHold(page: Page, id: string): Promise<void> {
  expect(await page.evaluate((holdId) => window.__ROUTE_SETTER_PERFORMANCE__!.selectHold(holdId), id)).toBe(true);
  await expect.poll(async () => (await sceneState(page)).selectedHoldId).toBe(id);
}

async function measureEndpointCommit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sposta' }).click();
  const handle = page.locator('[data-move="up"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y - 24, { steps: 2 });
  await page.mouse.up();
  await expect.poll(async () => (await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.snapshot())).endpointDurations.length).toBe(1);
}

async function sceneState(page: Page) {
  return page.evaluate(() => window.__ROUTE_SETTER_SCENE__!);
}

function summarize(
  telemetry: {
    startedAt: number | null;
    stoppedAt: number | null;
    renderTimestamps: readonly number[];
    renderDurations: readonly number[];
    endpointDurations: readonly number[];
    renderCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
    canvasCssSize: readonly [number, number];
    drawingBufferSize: readonly [number, number];
    webglVersion: string;
    webglVendor: string;
    webglRenderer: string;
  },
  responsiveness: { longTasks: readonly number[]; heartbeatDelays: readonly number[] },
  loadingResponsiveness: { longTasks: readonly number[]; heartbeatDelays: readonly number[] },
  attachmentResponsiveness: { longTasks: readonly number[]; heartbeatDelays: readonly number[] },
  holdLoadDurations: readonly number[],
  scene: { holdInstanceIds: readonly string[]; rigidBodyCount: number; colliderCount: number },
  pageErrors: readonly string[],
) {
  const startedAt = telemetry.startedAt ?? 0;
  const stoppedAt = telemetry.stoppedAt ?? startedAt;
  const wholeSeconds = Math.floor((stoppedAt - startedAt) / 1_000);
  const fps = Array.from({ length: wholeSeconds }, (_, index) => telemetry.renderTimestamps.filter(
    (timestamp) => timestamp >= startedAt + index * 1_000 && timestamp < startedAt + (index + 1) * 1_000,
  ).length);
  return {
    scenario: 'phase-11-40-holds',
    measuredDurationMs: stoppedAt - startedAt,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    scene: { holds: scene.holdInstanceIds.length, rigidBodies: scene.rigidBodyCount, colliders: scene.colliderCount },
    canvas: { css: telemetry.canvasCssSize, drawingBuffer: telemetry.drawingBufferSize },
    rendering: {
      frames: telemetry.renderTimestamps.length,
      medianFps: percentile(fps, 50),
      meanFps: average(fps),
      minimumFps: Math.min(...fps),
      p95RenderDurationMs: percentile(telemetry.renderDurations, 95),
      renderCalls: telemetry.renderCalls,
      triangles: telemetry.triangles,
      geometries: telemetry.geometries,
      textures: telemetry.textures,
    },
    responsiveness: {
      longTaskCount: responsiveness.longTasks.length,
      maxLongTaskMs: Math.max(0, ...responsiveness.longTasks),
      maxHeartbeatDelayMs: Math.max(0, ...responsiveness.heartbeatDelays),
      p95HeartbeatDelayMs: percentile(responsiveness.heartbeatDelays, 95),
    },
    loadingResponsiveness: {
      longTaskCount: loadingResponsiveness.longTasks.length,
      maxLongTaskMs: Math.max(0, ...loadingResponsiveness.longTasks),
      maxHeartbeatDelayMs: Math.max(0, ...loadingResponsiveness.heartbeatDelays),
      p95HeartbeatDelayMs: percentile(loadingResponsiveness.heartbeatDelays, 95),
      holdLoadP50Ms: percentile(holdLoadDurations, 50),
      holdLoadP95Ms: percentile(holdLoadDurations, 95),
      holdLoadMaxMs: Math.max(0, ...holdLoadDurations),
    },
    attachmentResponsiveness: {
      longTaskCount: attachmentResponsiveness.longTasks.length,
      maxLongTaskMs: Math.max(0, ...attachmentResponsiveness.longTasks),
      maxHeartbeatDelayMs: Math.max(0, ...attachmentResponsiveness.heartbeatDelays),
    },
    endpointLatency: {
      count: telemetry.endpointDurations.length,
      p50Ms: percentile(telemetry.endpointDurations, 50),
      maxMs: Math.max(0, ...telemetry.endpointDurations),
    },
    webgl: {
      version: telemetry.webglVersion,
      vendor: telemetry.webglVendor,
      renderer: telemetry.webglRenderer,
    },
    browser: navigatorDescription(),
    pageErrors,
  };
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length))];
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function navigatorDescription(): string {
  return 'Chromium Playwright 1.44.0';
}

declare global {
  interface Window {
    __PHASE11_RESPONSIVENESS__?: {
      snapshot(): { longTasks: readonly number[]; heartbeatDelays: readonly number[] };
      reset(): { longTasks: readonly number[]; heartbeatDelays: readonly number[] };
    };
  }
}
