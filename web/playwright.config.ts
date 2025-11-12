import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    channel: 'chrome',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        cwd: './',
        env: {
          NEXT_PUBLIC_API_MOCK: '1',
        },
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
