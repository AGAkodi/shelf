import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { localClients, root } from "./lib/local-supabase.mjs";
import "./install-development.mjs";
localClients();
writeFileSync(
  join(root, "supabase/.temp/development.env"),
  "SHELF_DEV_ADAPTER=enabled\n",
);
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/supabase/dist/supabase.js"),
    "functions",
    "serve",
    "shelf-api",
    "--env-file",
    "supabase/.temp/development.env",
  ],
  { cwd: root, stdio: "inherit" },
);
process.exit(result.status ?? 1);
