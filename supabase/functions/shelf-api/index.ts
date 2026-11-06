import { allowedOrigins } from "../_shared/origins.ts";
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
    development: false, // Production entry point never exposes the development payment adapter.
    origins: allowedOrigins(local, Deno.env.get("SHELF_ALLOWED_ORIGINS") ?? ""),
  }),
);
