import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localClients, root, sql } from "./lib/local-supabase.mjs";
localClients(); // Refuses any non-local API URL before touching the fixed Docker database.
sql(readFileSync(join(root, "supabase/development/adapter.sql"), "utf8"));
console.log(
  "Installed temporary development adapter in local Shelf only. No production deployment.",
);
