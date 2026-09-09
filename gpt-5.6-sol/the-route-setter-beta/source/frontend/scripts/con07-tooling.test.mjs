import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserProjects, parsePerformanceConfig, classifyRenderer, percentile, summarizeResponsiveness, certificationBlockers } from './con07-tooling.ts';

test('certification is the default and cannot silently reduce the workload', () => {
  const config = parsePerformanceConfig();
  assert.equal(config.mode, 'certification');
  assert.equal(config.holdCount, 40);
  assert.equal(config.durationMs, 60000);
  for (const environment of [{ PERF_HOLD_COUNT: '39' }, { PERF_DURATION_MS: '59999' }]) {
    assert.throws(() => parsePerformanceConfig(environment), /Certification requires/);
  }
  assert.equal(parsePerformanceConfig({ PERF_HOLD_COUNT: '48', PERF_DURATION_MS: '65000' }).smoke, false);
});

test('only explicit smoke mode permits a reduced run', () => {
  assert.equal(parsePerformanceConfig({ PERF_SMOKE: 'true', PERF_HOLD_COUNT: '2', PERF_DURATION_MS: '1000' }).mode, 'smoke');
  for (const environment of [
    { PERF_SMOKE: '1' }, { PERF_SMOKE: '' }, { PERF_HEADLESS: 'yes' },
    { PERF_HOLD_COUNT: 'NaN' }, { PERF_HOLD_COUNT: '40.5' }, { PERF_HOLD_COUNT: '' },
    { PERF_DURATION_MS: 'Infinity' }, { PERF_SMOKE: 'true', PERF_DURATION_MS: '0' },
    { PERF_SMOKE: 'true', PERF_HOLD_COUNT: '1' }, { PERF_BROWSER: 'chrome,msedge' },
  ]) assert.throws(() => parsePerformanceConfig(environment));
});

test('browser matrix is opt-in, uses installed branded channels, and rejects typos', () => {
  assert.deepEqual(browserProjects().map((project) => project.name), ['chromium']);
  assert.deepEqual(browserProjects('chrome, msedge,firefox,chromium,chrome'), [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'msedge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'chromium', use: { browserName: 'chromium' } },
  ]);
  for (const input of ['', 'all', 'chromiun', 'chromium,']) assert.throws(() => browserProjects(input));
});

test('software and masked/unknown adapters never count as hardware', () => {
  for (const renderer of ['ANGLE (Google, Vulkan (SwiftShader Device))', 'llvmpipe', 'Microsoft Basic Render Driver', 'WARP', 'Mesa softpipe']) {
    assert.equal(classifyRenderer(renderer), 'software');
  }
  for (const renderer of [null, '', 'WebKit WebGL', 'ANGLE', 'unrecognized adapter']) assert.equal(classifyRenderer(renderer), 'unknown');
  for (const renderer of ['ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)', 'NVIDIA GeForce RTX 4060', 'AMD Radeon', 'Apple M2']) {
    assert.equal(classifyRenderer(renderer), 'hardware');
  }
});

test('missing observations are null, observed absence of long tasks is zero', () => {
  assert.equal(summarizeResponsiveness({ longTasks: null, heartbeatDelays: [] }).maxLongTaskMs, null);
  assert.equal(summarizeResponsiveness({ longTasks: null, heartbeatDelays: [] }).longTaskCount, null);
  assert.equal(summarizeResponsiveness({ longTasks: [], heartbeatDelays: [1] }).maxLongTaskMs, 0);
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([4, 1, 3, 2], 50), 2);
  assert.equal(percentile([4, 1, 3, 2], 95), 4);
});

test('certification checks observed viewport, GPU, long-task support and visibility', () => {
  const runtime = { viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, visibility: 'visible', longTaskSupported: true,
    webgl: { renderer: 'NVIDIA GeForce RTX 4060', unmasked: true, contextLost: false } };
  assert.deepEqual(certificationBlockers(runtime), []);
  assert.deepEqual(certificationBlockers({ ...runtime, viewport: { ...runtime.viewport, deviceScaleFactor: 1.0000000149011612 } }), []);
  for (const override of [
    { viewport: { width: 1280, height: 720, deviceScaleFactor: 1 } },
    { viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 } },
    { viewport: { width: 1920, height: 1080, deviceScaleFactor: 1.01 } },
    { viewport: { width: 1920, height: 1080, deviceScaleFactor: NaN } },
    { visibility: 'hidden' }, { longTaskSupported: false }, { webgl: null },
    { webgl: { ...runtime.webgl, renderer: 'SwiftShader' } },
    { webgl: { ...runtime.webgl, unmasked: false } },
    { webgl: { ...runtime.webgl, contextLost: true } },
  ]) assert.ok(certificationBlockers({ ...runtime, ...override }).length > 0);
});
