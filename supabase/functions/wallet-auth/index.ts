import { allowedOrigins } from "../_shared/origins.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createWalletHandler } from "./handler.ts";
const url = Deno.env.get("SUPABASE_URL") ?? "";
const local = [
  "http://kong:8000",
  "http://127.0.0.1:55321",
  "http://supabase_kong_shelf:8000",
].includes(url);
const origins = allowedOrigins(local, Deno.env.get("SHELF_ALLOWED_ORIGINS") ?? "");
const server = createClient(
  url,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(createWalletHandler(server, origins));
