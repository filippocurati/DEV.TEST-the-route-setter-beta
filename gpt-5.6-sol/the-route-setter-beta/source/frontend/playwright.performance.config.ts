import { defineConfig, devices } from '@playwright/test';

const environment = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const frontendPort = Number(environment?.PERF_FRONTEND_PORT ?? 5174);
const backendPort = Number(environment?.PERF_BACKEND_PORT ?? 5081);
const dotnetCommand = environment?.DOTNET_COMMAND ?? 'dotnet';

export default defineConfig({
  testDir: './tests/performance',
  timeout: 15 * 60_000,
  workers: 1,
  retries: 0,
  reporter: [['line'], ['json', { outputFile: 'performance-results/playwright.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    headless: environment?.PERF_HEADLESS !== 'false',
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `"${dotnetCommand}" run --no-launch-profile --project ../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj --urls http://127.0.0.1:${backendPort}`,
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
