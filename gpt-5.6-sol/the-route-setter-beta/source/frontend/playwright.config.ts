import { defineConfig, devices } from '@playwright/test';

const dotnetCommand = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env?.DOTNET_COMMAND ?? 'dotnet';
const environment = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env;
const frontendPort = Number(environment?.E2E_FRONTEND_PORT ?? 5173);
const backendPort = Number(environment?.E2E_BACKEND_PORT ?? 5080);

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
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
      command: `"${dotnetCommand}" run --no-launch-profile --project ../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj --urls http://127.0.0.1:${backendPort}`,
      url: `http://127.0.0.1:${backendPort}/api/system/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: false,
    },
  ],
});
