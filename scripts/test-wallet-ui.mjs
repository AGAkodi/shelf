import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { localClients, root } from "./lib/local-supabase.mjs";
const { url, anonKey } = localClients();
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/@playwright/test/cli.js"),
    "test",
    "--config",
    "playwright.wallet.config.ts",
  ],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
      VITE_DEV_BORROWING: "",
      VITE_APP_URL: "",
    },
  },
);
process.exit(result.status ?? 1);
