import { defineConfig, devices, type ReporterDescription } from '@playwright/test';

const dotnetCommand = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env?.DOTNET_COMMAND ?? 'dotnet';
const environment = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const frontendPort = Number(environment?.E2E_FRONTEND_PORT ?? 5173);
const backendPort = Number(environment?.E2E_BACKEND_PORT ?? 5080);
const reuseExistingServer = environment?.E2E_REUSE_SERVER === 'true';
const backendCommand = environment?.E2E_BACKEND_COMMAND
  ?? `"${dotnetCommand}" run --no-launch-profile --project ../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj --urls http://127.0.0.1:${backendPort}`;
const reporter: ReporterDescription[] = environment?.CI
  ? [['line'], ['junit', { outputFile: 'test-results/playwright-junit.xml' }], ['html', { open: 'never' }]]
  : [['line']];

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  reporter,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: backendCommand,
      url: `http://127.0.0.1:${backendPort}/api/system/health`,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer,
    },
  ],
});
