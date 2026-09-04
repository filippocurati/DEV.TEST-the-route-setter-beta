import { defineConfig } from 'vite';

export default defineConfig(() => {
  const environment = (
    globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const frontendPort = Number(environment?.E2E_FRONTEND_PORT ?? 5173);
  const backendPort = Number(environment?.E2E_BACKEND_PORT ?? 5080);

  return {
    server: {
      port: frontendPort,
      proxy: {
        '/api': `http://127.0.0.1:${backendPort}`,
      },
    },
    preview: {
      port: frontendPort,
      proxy: {
        '/api': `http://127.0.0.1:${backendPort}`,
      },
    },
  };
});
