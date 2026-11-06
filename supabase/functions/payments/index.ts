import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { allowedOrigins } from "../_shared/origins.ts";
import { chainBaseline, rpcClient, verifyTransfer } from "./verify.ts";
const url = Deno.env.get("SUPABASE_URL") ?? "";
const server = createClient(
  url,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const local = [
  "http://kong:8000",
  "http://127.0.0.1:54321",
  "http://supabase_kong_shelf:8000",
].includes(url);
const origins = allowedOrigins(
  local,
  Deno.env.get("SHELF_ALLOWED_ORIGINS") ?? "",
);
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async (req) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  const send = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  const origin = req.headers.get("origin") ?? "";
  if (!origins.includes(origin)) return send({ error: "Origin denied" }, 403);
  headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] =
    "authorization, apikey, content-type, x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return send({ error: "Method not allowed" }, 405);
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return send({ error: "Sign in required" }, 401);
    const { data, error } = await server.auth.getUser(token);
    if (error || !data.user?.email_confirmed_at) {
      return send({ error: "Sign in required" }, 401);
    }
    const claims = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      !uuid(claims.session_id) || !Array.isArray(claims.amr) ||
      !claims.amr.some((a: { method: string }) => a.method === "otp")
    ) return send({ error: "Email OTP required" }, 401);
    const user = data.user.id, session = claims.session_id;
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const r = await server.rpc(name, { p_user: user, ...args });
      if (r.error) {
        throw new Error(
          r.error.code === "P0001"
            ? "Please wait before checking again."
            : "Checkout unavailable. Check your wallet verification and My Library.",
        );
      }
      return r.data;
    };
    const reader = req.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          await reader.cancel();
          return send({ error: "Request too large" }, 413);
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (!b || typeof b !== "object" || Array.isArray(b)) {
      return send({ error: "Invalid request" }, 400);
    }
    if (
      b.action === "checkout" && uuid(b.bookId) && uuid(b.planId) && uuid(b.key)
    ) {
      const open = await server.from("loans").select("id,borrowing_plan_id")
        .eq("user_id", user).eq("book_id", b.bookId).eq("status", "pending_payment").maybeSingle();
      if (open.error) throw open.error;
      if (open.data) {
        if (open.data.borrowing_plan_id !== b.planId) {
          return send({ error: "OPEN_CHECKOUT" }, 409);
        }
        const existing = await server.from("payments").select("id")
          .eq("user_id", user).eq("loan_id", open.data.id).eq("environment", "production")
          .in("status", ["pending", "submitted", "verifying"]).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) return send(await rpc("payment_state", { p_payment: existing.data.id }));
      }
      const recipient = (Deno.env.get("PAYMENT_RECIPIENT_ADDRESS") ?? "")
        .toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(recipient) || /^0x0{40}$/.test(recipient)) {
        return send({ error: "Payments are not configured" }, 503);
      }
      const chain = rpcClient(Deno.env.get("POLYGON_RPC_URL") ?? "");
      let block;
      try {
        block = await chainBaseline(chain);
      } catch {
        return send({ error: "POLYGON_UNAVAILABLE" }, 503);
      }
      return send(
        await rpc("payment_checkout", {
          p_session: session,
          p_book: b.bookId,
          p_plan: b.planId,
          p_key: b.key,
          p_recipient: recipient,
          p_block: block,
        }),
      );
    }
    if (!uuid(b.paymentId)) return send({ error: "Invalid payment" }, 400);
    const args = { p_session: session, p_payment: b.paymentId };
    if (b.action === "status") {
      return send(await rpc("payment_state", { p_payment: b.paymentId }));
    }
    if (b.action === "claim" || b.action === "rejected") {
      if (b.action === "rejected" && !uuid(b.claimToken)) return send({ error: "Invalid prompt" }, 400);
      return send(await rpc("payment_prompt", { ...args, p_action: b.action, p_token: b.claimToken ?? null }));
    }
    if (b.action === "cancel") {
      return send(
        await rpc("payment_dispatch", { ...args, p_action: b.action }),
      );
    }
    if (b.action === "verify") {
      let state = await rpc("payment_dispatch", { ...args, p_action: "check" });
      if (state.payment.status === "confirmed") return send(state);
      if (b.hash !== undefined) {
        if (typeof b.hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(b.hash)) {
          return send({ error: "Invalid transaction hash" }, 400);
        }
        state = await rpc("payment_dispatch", {
          ...args,
          p_action: "candidate",
          p_hash: b.hash.toLowerCase(),
        });
      }
      const hash = state.candidate_hash;
      if (!hash) {
        return send({
          ...state,
          message:
            "Outcome unknown. Check wallet history and supply the transaction hash. Do not send again.",
        });
      }
      const evidence = await verifyTransfer(
        rpcClient(Deno.env.get("POLYGON_RPC_URL") ?? ""),
        state.payment,
        hash,
      );
      if (!evidence) {
        return send({
          ...state,
          message:
            "Waiting for a canonical finalized transaction. Access remains locked.",
        });
      }
      return send(
        await rpc(evidence.success ? "payment_finalize" : "payment_fail", {
          p_payment: b.paymentId,
          p_hash: evidence.hash,
          p_block: evidence.block,
          p_block_hash: evidence.blockHash,
          p_block_time: evidence.time,
          p_finalized: evidence.finalized,
        }),
      );
    }
    return send({ error: "Unknown action" }, 400);
  } catch {
    return send({
      error:
        "Payment could not be verified or checkout is unavailable. No access was granted. Check My Library and reconcile the transaction before sending again.",
    }, 409);
  }
});
