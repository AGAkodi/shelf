import { defineConfig, devices } from "@playwright/test";

// Production build served with vercel.json headers. The Supabase values are structurally valid
// placeholders so the client is created and the CSP is exercised; they reach no real project.
const env = {
  VITE_SUPABASE_URL: "https://placeholder-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder_for_header_tests",
  VITE_APP_URL: "",
  VITE_DEV_BORROWING: "",
};
export default defineConfig({
  testDir: "./tests/dist",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4174" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: "npm run build && node scripts/serve-dist.mjs",
    url: "http://127.0.0.1:4174",
    env,
    timeout: 180000,
    reuseExistingServer: false,
  },
});
