import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { installInputObservers } from './con07-tooling.ts';

test('release observer measures real target work, not an early capture microtask', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(installInputObservers);
    await page.goto('data:text/html,<button>Local input fixture</button>');
    await page.evaluate(() => {
      window.__ROUTE_SETTER_SCENE__ = { dragPreview: { kind: 'move' } };
      document.querySelector('button').addEventListener('pointerup', () => {
        const start = performance.now();
        while (performance.now() - start < 30) { /* Deliberate bounded synchronous target work. */ }
      });
    });
    await page.locator('button').click();
    await page.locator('button').click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const sample = await page.evaluate(() => window.__CON07__.snapshot());
    assert.equal(sample.releaseHandlerMs.length, 2);
    assert.ok(sample.releaseHandlerMs.every((duration) => duration >= 29));
    assert.equal(sample.releaseToFrameMs.length, 2);
    assert.ok(sample.releaseToFrameMs.every((duration) => duration >= 29));
    await page.locator('button').dispatchEvent('pointerup', { pointerType: 'mouse' });
    assert.equal((await page.evaluate(() => window.__CON07__.snapshot())).releaseHandlerMs.length, 2);
    await page.evaluate(() => window.__CON07__.reset());
    assert.equal((await page.evaluate(() => window.__CON07__.snapshot())).releaseHandlerMs.length, 0);
  } finally {
    await browser.close();
  }
});

test('unsupported long-task API is reported unavailable, not zero', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('data:text/html,<title>No long-task API</title>');
    await page.evaluate(() => Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] }));
    await page.evaluate(installInputObservers);
    assert.equal((await page.evaluate(() => window.__CON07__.snapshot())).longTasks, null);
    assert.equal((await page.evaluate(() => window.__CON07__.reset())).longTasks, null);
  } finally {
    await browser.close();
  }
});
