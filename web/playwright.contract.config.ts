import path from 'node:path'
import { defineConfig } from '@playwright/test'

const runStamp = new Date().toISOString().replace(/[:.]/g, '-')

export default defineConfig({
  testDir: './tests/contract',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: path.join('test-results', 'contract-artifacts', runStamp),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    channel: 'chromium',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        cwd: './',
        env: {
          NEXT_PUBLIC_API_MOCK: '1',
          NEXT_PUBLIC_PLAY_AUTOSTART: '0',
          NEXT_DISABLE_DEVTOOLS: '1',
          NEXT_TELEMETRY_DISABLED: '1',
        },
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
