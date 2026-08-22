import { defineConfig, devices } from '@playwright/test';

const dotnetCommand = (
  globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
).process?.env?.DOTNET_COMMAND ?? 'dotnet';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
      command: `"${dotnetCommand}" run --no-launch-profile --project ../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj --urls http://127.0.0.1:5080`,
      url: 'http://127.0.0.1:5080/api/system/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
    },
  ],
});
