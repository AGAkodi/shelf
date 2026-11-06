import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { rpcClient, verifyTransfer } from "../payments/verify.ts";
const server = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
// Scheduled backend entry only. No service key is supplied by a browser.
Deno.serve(async (req) => {
  const secret = Deno.env.get("PAYMENT_RECONCILE_SECRET");
  if (
    req.method !== "POST" || !secret || secret.length < 32 ||
    req.headers.get("x-shelf-reconcile") !== secret
  ) return new Response("Denied", { status: 403 });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await server.rpc(name, args);
    if (r.error) throw new Error("Denied");
    return r.data;
  };
  let resolved = 0;
  try {
    const chain = rpcClient(Deno.env.get("POLYGON_RPC_URL") ?? "");
    const queue = await rpc("payment_queue", {});
    // Bounded batch and individual timeouts; a bad item never prevents later payments from reconciling.
    await Promise.all(
      queue.slice(0, 10).map(
        async (
          item: { id: string; user_id: string; candidate_hash: string },
        ) => {
          try {
            const state = await rpc("payment_dispatch", {
              p_user: item.user_id,
              p_session: null,
              p_payment: item.id,
              p_action: "check",
            });
            if (state.payment.status !== "pending") return;
            const e = await verifyTransfer(
              chain,
              state.payment,
              item.candidate_hash,
            );
            if (!e) return;
            await rpc(e.success ? "payment_finalize" : "payment_fail", {
              p_user: item.user_id,
              p_payment: item.id,
              p_hash: e.hash,
              p_block: e.block,
              p_block_hash: e.blockHash,
              p_block_time: e.time,
              p_finalized: e.finalized,
            });
            resolved++;
          } catch {
            /* Leave unresolved; never infer success or retry a transfer. */
          }
        },
      ),
    );
    return Response.json({ resolved }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Reconciliation unavailable" }, {
      status: 503,
    });
  }
});
