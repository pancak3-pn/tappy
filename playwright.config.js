import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: (process.env.E2E_BASE_URL || 'https://www.tappycard.tech').replace(/\/$/, ''),
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
})
