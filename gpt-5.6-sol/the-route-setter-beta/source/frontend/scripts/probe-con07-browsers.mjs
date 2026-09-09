import { chromium, firefox } from '@playwright/test';
import os from 'node:os';
import { browserProjects, readBrowserTelemetry, classifyRenderer, certificationBlockers } from './con07-tooling.ts';

// No server, installation, GPU overrides, or browser downloads. Launch sequentially.
const projects = browserProjects(process.env.E2E_BROWSERS ?? 'chromium');
const headless = process.env.PERF_HEADLESS !== 'false';
const results = [];
for (const project of projects) {
  let browser;
  try {
    browser = await (project.use.browserName === 'firefox' ? firefox : chromium).launch({
      channel: project.use.channel, headless, timeout: 30_000,
    });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto('data:text/html,<title>CON07 capability probe</title>');
    const runtime = await page.evaluate(readBrowserTelemetry);
    results.push({ project: project.name, launched: true, version: browser.version(), headless, runtime,
      rendererClass: classifyRenderer(runtime.webgl?.renderer ?? null), certificationBlockers: certificationBlockers(runtime) });
  } catch (error) {
    results.push({ project: project.name, launched: false, headless, error: String(error) });
  } finally {
    await browser?.close();
  }
}
console.log(JSON.stringify({ purpose: 'capability-only; not a performance certification', node: process.version,
  playwright: (await import('@playwright/test/package.json', { with: { type: 'json' } })).default.version,
  host: { platform: os.platform(), release: os.release(), architecture: os.arch(),
    cpu: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length, memoryGiB: os.totalmem() / 1024 ** 3,
    sessionName: process.env.SESSIONNAME ?? null }, results }, null, 2));
if (results.some((result) => !result.launched)) process.exitCode = 1;
