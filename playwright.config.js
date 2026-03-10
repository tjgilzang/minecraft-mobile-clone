import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/playwright/minecraft-clone-report.json' }]
  ],
  use: {
    viewport: { width: 390, height: 844 },
    baseURL: 'http://127.0.0.1:4180',
    launchOptions: {
      args: ['--disable-dev-shm-usage']
    },
    actionTimeout: 10_000
  },
  webServer: {
    command: 'npx http-server dist -p 4180 -c-1',
    port: 4180,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
