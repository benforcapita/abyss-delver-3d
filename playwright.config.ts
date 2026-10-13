import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // CI runners render WebGL via SwiftShader and are slow; local runs keep Playwright defaults.
  ...(process.env.CI ? {retries: 1, workers: 1, timeout: 60000} : {}),
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
