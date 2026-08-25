import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  webServer: [
    {
      command:
        process.env.E2E_BACKEND_CMD ??
        'dotnet run --project "../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj" --urls http://127.0.0.1:5099',
      url: 'http://127.0.0.1:5099/swagger/index.html',
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false
    }
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173'
  }
});
