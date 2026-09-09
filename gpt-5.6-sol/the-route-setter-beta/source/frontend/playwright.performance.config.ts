import { defineConfig } from '@playwright/test';
import { parsePerformanceConfig } from './scripts/con07-tooling';

const environment = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const frontendPort = Number(environment?.PERF_FRONTEND_PORT ?? 5174);
const backendPort = Number(environment?.PERF_BACKEND_PORT ?? 5081);
const dotnetCommand = environment?.DOTNET_COMMAND ?? 'dotnet';
const performance = parsePerformanceConfig(environment);

export default defineConfig({
  testDir: './tests/performance',
  timeout: 15 * 60_000,
  workers: 1,
  retries: 0,
  outputDir: 'performance-results/artifacts',
  projects: [performance.project],
  metadata: { mode: performance.mode, holdCount: performance.holdCount, durationMsPerPhase: performance.durationMs },
  reporter: [['line'], ['json', { outputFile: 'performance-results/playwright.json' }]],
  use: {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    headless: performance.headless,
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: environment?.PERF_BACKEND_COMMAND
        ?? `"${dotnetCommand}" run --no-launch-profile --project ../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj --urls http://127.0.0.1:${backendPort}`,
      url: `http://127.0.0.1:${backendPort}/api/system/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run preview -- --host 127.0.0.1 --port ${frontendPort}`,
      url: `http://127.0.0.1:${frontendPort}`,
      env: { E2E_BACKEND_PORT: String(backendPort) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
