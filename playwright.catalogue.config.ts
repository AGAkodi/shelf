import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/catalogue', timeout: 90000, workers: 2, expect: { timeout: 15000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5189', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5189 --strictPort', url: 'http://127.0.0.1:5189', reuseExistingServer: false },
})
