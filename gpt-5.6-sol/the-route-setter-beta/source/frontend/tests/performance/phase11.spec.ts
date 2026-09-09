import { expect, test, type Page } from '@playwright/test';
import {
  certificationBlockers, classifyRenderer, installInputObservers, parsePerformanceConfig, percentile,
  readBrowserTelemetry, summarizeResponsiveness,
} from '../../scripts/con07-tooling';

const environment = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const config = parsePerformanceConfig(environment);

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
  const evidence = await page.evaluate(() => ({
    scene: window.__ROUTE_SETTER_SCENE__, telemetry: window.__ROUTE_SETTER_PERFORMANCE__?.snapshot(),
    responsiveness: window.__CON07__?.snapshot(),
  }));
  await testInfo.attach('con07-failure-state.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

for (const scenario of [
  { name: 'typical', holds: Math.min(8, config.holdCount) },
  { name: 'complex', holds: config.holdCount },
]) {
  test(`CON07 ${scenario.name}: mixed models, selection, mouse move and rotation (${config.mode})`, async ({ page, browser }, testInfo) => {
    test.setTimeout(Math.max(15 * 60_000, config.durationMs * 2 + 10 * 60_000));
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(installInputObservers);
    let sourceModels: Array<Record<string, unknown>> = [];
    await page.route(/\/api\/holds(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      sourceModels = await response.json() as Array<Record<string, unknown>>;
      expect(sourceModels.length).toBeGreaterThanOrEqual(2);
      await route.fulfill({ response, json: Array.from({ length: scenario.holds }, (_, index) => ({
        ...sourceModels[index % sourceModels.length], id: holdId(index),
      })) });
    });

    await page.goto('/?performance=1');
    await expect(page.getByRole('status')).toHaveText('Parete pronta', { timeout: 60_000 });
    const runtime = await page.evaluate(readBrowserTelemetry);
    const preflight = { mode: config.mode, browserVersion: browser.version(), project: testInfo.project.name,
      headless: config.headless, runtime, rendererClass: classifyRenderer(runtime.webgl?.renderer ?? null),
      blockers: certificationBlockers(runtime), certified: false };
    await testInfo.attach('con07-preflight.json', { body: JSON.stringify(preflight, null, 2), contentType: 'application/json' });
    if (!config.smoke) expect(preflight.blockers, 'Certification preflight; use PERF_SMOKE=true only for non-certifying runs').toEqual([]);
    expect(runtime.webgl, 'Even smoke requires working WebGL').not.toBeNull();
    await expect(page.locator('.hold-card')).toHaveCount(scenario.holds);

    await page.evaluate(() => window.__CON07__!.reset());
    const loadDurations: number[] = [];
    for (let index = 0; index < scenario.holds; index += 1) {
      const id = holdId(index);
      const started = performance.now();
      await page.locator(`[data-hold-id="${id}"]`).getByRole('button', { name: 'Utilizza' }).click();
      await expect(page.locator('[data-catalog-feedback]')).toHaveText(`${id} aggiunta alla scena.`, { timeout: 120_000 });
      loadDurations.push(performance.now() - started);
    }
    const loading = await page.evaluate(() => window.__CON07__!.reset());

    // Spread every hold across actual wall surfaces, not a pile of detached spawn objects.
    // Setup may select through the debug API; the measured phase must select by mouse.
    const canvasBox = (await page.locator('[data-scene-canvas]').boundingBox())!;
    const targets = Array.from({ length: 81 }, (_, index) => ({
      x: 0.5 + ((index % 9) - 4) * 0.07, y: 0.5 + (Math.floor(index / 9) - 4) * 0.075,
    })).sort((a, b) => Math.hypot(a.x - 0.5, a.y - 0.5) - Math.hypot(b.x - 0.5, b.y - 0.5));
    let candidate = 0;
    for (let index = 0; index < scenario.holds; index += 1) {
      const id = holdId(index);
      expect(await page.evaluate((id) => window.__ROUTE_SETTER_PERFORMANCE__!.selectHold(id), id)).toBe(true);
      await page.getByRole('button', { name: 'Aggancia', exact: true }).click();
      while ((await sceneState(page)).holdStates[id].physicalState !== 'attached' && candidate < targets.length) {
        const target = targets[candidate++];
        await page.mouse.click(canvasBox.x + target.x * canvasBox.width, canvasBox.y + target.y * canvasBox.height);
      }
      expect((await sceneState(page)).holdStates[id].physicalState, `Attach ${id}; fixture must fit real wall surfaces`).toBe('attached');
    }
    const attachment = await page.evaluate(() => window.__CON07__!.reset());
    const populated = await sceneState(page);
    expect(populated.holdInstanceIds).toHaveLength(scenario.holds);
    expect(populated.rigidBodyCount).toBe(scenario.holds + 1);
    expect(populated.colliderCount).toBe(scenario.holds + 1);

    await page.keyboard.press('Escape');
    // Synthetic orbit stresses rendering separately from the real-input phase.
    await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.start());
    let telemetry;
    try {
      await page.waitForTimeout(config.durationMs);
    } finally {
      telemetry = await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.stop());
    }
    const renderingResponsiveness = await page.evaluate(() => window.__CON07__!.reset());
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.snapshot().active)).toBe(false);

    const selections: string[] = [];
    const selectionAttempts: Array<{ hold: string; attempts: number; offset: readonly number[] }> = [];
    const endpoints: Array<{ hold: string; kind: 'move' | 'rotate'; status: string; reason: string | null }> = [];
    await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.start({ animateCamera: false }));
    const inputStarted = (await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.snapshot())).startedAt!;
    let cycle = 0;
    let inputTelemetry;
    try {
      // Two passes minimum, so even a reduced smoke run exercises multiple holds and endpoints.
      do {
        const id = holdId(cycle % scenario.holds);
        selectionAttempts.push(await selectByMouse(page, id));
        selections.push(id);
        for (const kind of ['move', 'rotate'] as const) {
          await page.getByRole('button', { name: kind === 'move' ? 'Sposta' : 'Ruota', exact: true }).click();
          const reverse = Math.floor(cycle / scenario.holds) % 2 === 1;
          const selector = kind === 'move' ? `[data-move="${reverse ? 'down' : 'up'}"]` : '[data-rotate="clockwise"]';
          const box = (await page.locator(selector).boundingBox())!;
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          const delta = (kind === 'move' ? -18 : 24) * (reverse ? -1 : 1);
          const before = await sceneState(page);
          await page.mouse.move(x, y);
          await page.mouse.down();
          try {
            for (let step = 1; step <= 8; step += 1) {
              await page.mouse.move(x, y + delta * step / 8);
              await page.waitForTimeout(16);
            }
            await expect.poll(async () => (await sceneState(page)).dragPreview?.kind).toBe(kind);
            const preview = await sceneState(page);
            expect(preview.selectedHoldPosition).toEqual(before.selectedHoldPosition);
            expect(preview.selectedHoldRotation).toEqual(before.selectedHoldRotation);
            expect(preview.poseValidationCount).toBe(before.poseValidationCount);
            expect(preview.dragCandidateEndpointAvailable).toBe(true);
            expect(preview.orbitControlsEnabled).toBe(false);
            // Test actual wheel input while capture is active, not just the controls flag.
            await page.mouse.wheel(0, 80);
            await page.waitForTimeout(50);
            const frozen = await sceneState(page);
            expect(frozen.cameraPosition).toEqual(before.cameraPosition);
            expect(frozen.cameraQuaternion).toEqual(before.cameraQuaternion);
            expect(frozen.controlsTarget).toEqual(before.controlsTarget);
            expect(frozen.cameraZoom).toBe(before.cameraZoom);
          } finally {
            await page.mouse.up();
          }
          await expect.poll(async () => (await sceneState(page)).dragPreview).toBeNull();
          const after = await sceneState(page);
          expect(after.poseValidationCount).toBe(before.poseValidationCount + 1);
          expect(after.orbitControlsEnabled).toBe(true);
          expect(after.previewObjectCount).toBe(0);
          expect(['committed', 'invalid-endpoint']).toContain(after.lastActionResult?.status);
          if (after.lastActionResult?.status === 'committed') {
            expect(kind === 'move' ? after.selectedHoldPosition : after.selectedHoldRotation)
              .not.toEqual(kind === 'move' ? before.selectedHoldPosition : before.selectedHoldRotation);
          }
          endpoints.push({ hold: id, kind, status: after.lastActionResult!.status, reason: after.lastActionResult?.reason ?? null });
        }
        cycle += 1;
      } while (cycle < scenario.holds * 2 || await page.evaluate(() => performance.now()) - inputStarted < config.durationMs);
      // Allow the final release's animation-frame observation to complete.
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    } finally {
      inputTelemetry = await page.evaluate(() => window.__ROUTE_SETTER_PERFORMANCE__!.stop());
    }
    const inputStopped = inputTelemetry.stoppedAt!;
    const interaction = await page.evaluate(() => window.__CON07__!.snapshot());
    const finalRuntime = await page.evaluate(readBrowserTelemetry);
    const renderStarted = telemetry.startedAt!;
    const renderStopped = telemetry.stoppedAt!;
    // No input runs here, so FPS describes only the controller's synthetic orbit.
    const seconds = Math.floor((renderStopped - renderStarted) / 1000);
    const fps = Array.from({ length: seconds }, (_, second) => telemetry.renderTimestamps.filter(
      (timestamp) => timestamp >= renderStarted + second * 1000 && timestamp < renderStarted + (second + 1) * 1000,
    ).length);
    const committed = endpoints.filter((sample) => sample.status === 'committed');
    const endpointByKind = Object.fromEntries((['move', 'rotate'] as const).map((kind) => {
      const samples = interaction.releaseHandlerMs.filter((_, index) => endpoints[index]?.kind === kind);
      return [kind, { count: samples.length, p50Ms: percentile(samples, 50), maxMs: samples.length ? Math.max(...samples) : null }];
    }));
    const checks = {
      environment: config.smoke || certificationBlockers(finalRuntime).length === 0,
      renderDuration: renderStopped - renderStarted >= config.durationMs,
      inputDuration: inputStopped - inputStarted >= config.durationMs,
      fps: (percentile(fps, 50) ?? -1) >= 30,
      longTasks: [loading, attachment, renderingResponsiveness, interaction].every((sample) =>
        sample.longTasks !== null && Math.max(0, ...sample.longTasks) <= 200),
      heartbeat: [loading, attachment, renderingResponsiveness, interaction].every((sample) =>
        (percentile(sample.heartbeatDelays, 95) ?? Infinity) <= 200),
      endpointP50: (percentile(interaction.releaseHandlerMs, 50) ?? Infinity) <= 50,
      endpointP50ByKind: Object.values(endpointByKind).every((sample) => (sample.p50Ms ?? Infinity) <= 50),
      endpointMax: interaction.releaseHandlerMs.length > 0 && Math.max(...interaction.releaseHandlerMs) <= 100,
      samples: interaction.releaseHandlerMs.length === endpoints.length && endpoints.length >= scenario.holds * 4,
      solverSamples: inputTelemetry.endpointDurations.length === endpoints.length,
      inputRenders: inputTelemetry.renderTimestamps.length > 0,
      solverP50: (percentile(inputTelemetry.endpointDurations, 50) ?? Infinity) <= 50,
      solverMax: inputTelemetry.endpointDurations.length > 0 && Math.max(...inputTelemetry.endpointDurations) <= 100,
      successfulTransforms: ['move', 'rotate'].every((kind) => new Set(committed.filter((sample) => sample.kind === kind).map((sample) => sample.hold)).size >= 2),
      selectionCoverage: new Set(selections).size === scenario.holds,
      visibleThroughout: [loading, attachment, renderingResponsiveness, interaction].every((sample) => sample.hiddenTransitions === 0),
      pageErrors: pageErrors.length === 0,
    };
    const result = {
      scenario: `con07-${scenario.name}`, mode: config.mode,
      certificationStatus: config.smoke ? 'not-certified-smoke' : Object.values(checks).every(Boolean) ? 'passed-split-phase-profile' : 'failed',
      scope: 'Synthetic render-load measured separately; normal-input phase captures real renders and solver endpoints without synthetic camera motion. On-demand render count is not continuous FPS.',
      browser: preflight, finalRuntime, sourceModels,
      scene: { holds: populated.holdInstanceIds.length, attached: Object.values(populated.holdStates).filter((hold) => hold.physicalState === 'attached').length,
        rigidBodies: populated.rigidBodyCount, colliders: populated.colliderCount,
        wallVertices: populated.triMeshVertexCount, wallIndices: populated.triMeshIndexCount },
      rendering: { measuredDurationMs: renderStopped - renderStarted, medianFps: percentile(fps, 50), perSecondFps: fps,
        p95RenderDurationMs: percentile(telemetry.renderDurations, 95), triangles: telemetry.triangles,
        renderCalls: telemetry.renderCalls, geometries: telemetry.geometries, textures: telemetry.textures,
        canvasCss: telemetry.canvasCssSize, drawingBuffer: telemetry.drawingBufferSize,
        responsiveness: summarizeResponsiveness(renderingResponsiveness) },
      loading: { durationsMs: loadDurations, responsiveness: summarizeResponsiveness(loading) },
      attachment: summarizeResponsiveness(attachment),
      input: { measuredDurationMs: inputStopped - inputStarted, selections, selectionAttempts, endpoints,
        rendering: { frames: inputTelemetry.renderTimestamps.length, timestamps: inputTelemetry.renderTimestamps,
          p95RenderDurationMs: percentile(inputTelemetry.renderDurations, 95) },
        solverEndpointLatency: { count: inputTelemetry.endpointDurations.length,
          p50Ms: percentile(inputTelemetry.endpointDurations, 50),
          maxMs: inputTelemetry.endpointDurations.length ? Math.max(...inputTelemetry.endpointDurations) : null,
          samplesMs: inputTelemetry.endpointDurations },
        responsiveness: summarizeResponsiveness(interaction),
        endpointLatency: { definition: 'Trusted pointerup capture to microtask from final bubble listener; includes UI/solver, not solver-only or Playwright round-trip. RAF samples are not paint acknowledgements.',
          count: interaction.releaseHandlerMs.length, p50Ms: percentile(interaction.releaseHandlerMs, 50),
          maxMs: interaction.releaseHandlerMs.length ? Math.max(...interaction.releaseHandlerMs) : null,
          byKind: endpointByKind, samplesMs: interaction.releaseHandlerMs, releaseToAnimationFrameMs: interaction.releaseToFrameMs } },
      checks, pageErrors,
    };
    await testInfo.attach('phase-11-performance.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    // Smoke retains behavioral assertions, but software performance is report-only.
    for (const key of ['renderDuration', 'inputDuration', 'samples', 'solverSamples', 'inputRenders', 'successfulTransforms', 'selectionCoverage', 'pageErrors'] as const) {
      expect(checks[key], key).toBe(true);
    }
    if (!config.smoke) for (const [name, passed] of Object.entries(checks)) expect(passed, name).toBe(true);
  });
}

function holdId(index: number) { return `BenchmarkHold${String(index + 1).padStart(2, '0')}`; }

async function sceneState(page: Page) { return page.evaluate(() => window.__ROUTE_SETTER_SCENE__!); }

async function selectByMouse(page: Page, id: string) {
  await page.keyboard.press('Escape');
  const box = (await page.locator('[data-scene-canvas]').boundingBox())!;
  const [x, y] = (await sceneState(page)).holdScreenPositions[id];
  // The debug pick point was chosen at spawn, before attachment/rotation. Search
  // a bounded local patch using real clicks; never substitute controller selection.
  const offsets = [[0, 0], ...[3, 6, 9, 12].flatMap((r) => [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]])];
  for (const [index, offset] of offsets.entries()) {
    if (index > 0) await page.keyboard.press('Escape');
    await page.mouse.click(box.x + (x + 1) / 2 * box.width + offset[0], box.y + (1 - y) / 2 * box.height + offset[1]);
    if ((await sceneState(page)).selectedHoldId === id) return { hold: id, attempts: index + 1, offset };
  }
  expect((await sceneState(page)).selectedHoldId, `Real mouse selection of ${id} within 12 px of projected mesh point`).toBe(id);
  throw new Error(`Could not select ${id}`);
}
