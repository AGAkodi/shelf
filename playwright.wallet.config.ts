import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/wallet",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 45000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: process.env.SHELF_USE_LOCAL_PREVIEW === "1",
  },
});
