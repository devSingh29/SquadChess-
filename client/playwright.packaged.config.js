import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/packaged',
  timeout: 45000,
  globalTimeout: 180000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/packaged', open: 'never' }]],
  outputDir: './test-results/packaged',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'packaged-chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run preview -- --host localhost --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
