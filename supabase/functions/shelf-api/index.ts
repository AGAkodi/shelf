import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createHandler } from "../_shared/handler.js";
const url = Deno.env.get("SUPABASE_URL") ?? "";
const server = createClient(
  url,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
// An env flag alone cannot enable a deployed adapter. Local Docker URL is mandatory too.
const local = [
  "http://kong:8000",
  "http://127.0.0.1:54321",
  "http://supabase_kong_shelf:8000",
].includes(url);
Deno.serve(
  createHandler({
    server,
    development: local && Deno.env.get("SHELF_DEV_ADAPTER") === "enabled",
    origins: local
      ? ["http://127.0.0.1:5173", "http://localhost:5173"]
      : (Deno.env.get("SHELF_ALLOWED_ORIGINS") ?? "")
          .split(",")
          .filter(Boolean),
  }),
);
