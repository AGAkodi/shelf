import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { verifyTypedData } from "npm:viem@2.57.14";
import {
  walletTypedData,
  type WalletChallenge,
} from "../../../shared/wallet-challenge.ts";
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
const hash = async (text: string) =>
  hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  );
export function createWalletHandler(server: SupabaseClient, origins: string[]) {
  return async (req: Request) => {
    const origin = req.headers.get("origin") ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    };
    const send = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (!origins.includes(origin)) return send({ error: "Origin denied" }, 403);
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return send({ error: "Method not allowed" }, 405);
    try {
      const bearer = req.headers.get("authorization");
      if (!bearer?.startsWith("Bearer "))
        return send({ error: "Sign in required" }, 401);
      const token = bearer.slice(7);
      const { data: auth, error } = await server.auth.getUser(token);
      if (error || !auth.user?.email_confirmed_at)
        return send({ error: "Confirmed email sign-in required" }, 401);
      // Decode only after getUser has validated this exact JWT. DB also checks session ownership/liveness.
      const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(encoded)) as {
        session_id?: unknown;
        amr?: { method?: string }[];
      };
      if (
        !uuid(claims.session_id) ||
        !Array.isArray(claims.amr) ||
        !claims.amr.some((item) => item.method === "otp")
      )
        return send({ error: "Email OTP session required" }, 401);
      const context = { p_user: auth.user.id, p_session: claims.session_id };
      const rpc = async (name: string, args: Record<string, unknown>) => {
        const result = await server.rpc(name, { ...context, ...args });
        if (result.error)
          throw new Error(result.error.code === "P0001" ? "rate" : "denied");
        return result.data;
      };
      const reader = req.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
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
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const body = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body !== "object" || Array.isArray(body))
        return send({ error: "Invalid request" }, 400);
      if (body.action === "status") return send(await rpc("wallet_status", {}));
      if (body.action === "invalidate") {
        await rpc("wallet_invalidate", {});
        return send({ ok: true });
      }
      if (body.action === "challenge") {
        if (
          typeof body.address !== "string" ||
          !/^0x[0-9a-f]{40}$/i.test(body.address) ||
          body.chainId !== 137
        )
          return send({ error: "Polygon account required" }, 400);
        const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = (await rpc("wallet_challenge_create", {
          p_address: body.address.toLowerCase(),
          p_origin: origin,
          p_nonce: "0x" + hex(crypto.getRandomValues(new Uint8Array(32))),
          p_secret_hash: await hash(secret),
        })) as WalletChallenge;
        return send({
          challenge,
          secret,
          typedData: walletTypedData(challenge),
        });
      }
      if (body.action === "verify") {
        if (
          !uuid(body.id) ||
          typeof body.secret !== "string" ||
          !/^[0-9a-f]{64}$/.test(body.secret) ||
          typeof body.signature !== "string" ||
          !/^0x[0-9a-f]{130}$/i.test(body.signature)
        )
          return send({ error: "Invalid proof" }, 400);
        const args = {
          p_id: body.id,
          p_origin: origin,
          p_secret_hash: await hash(body.secret),
        };
        const challenge = (await rpc(
          "wallet_challenge_attempt",
          args,
        )) as WalletChallenge;
        const typed = walletTypedData(challenge);
        const valid = await verifyTypedData({
          ...typed,
          domain: { ...typed.domain, chainId: 137n },
          message: {
            ...typed.message,
            issuedAt: BigInt(typed.message.issuedAt),
            expiresAt: BigInt(typed.message.expiresAt),
          },
          address: challenge.address as `0x${string}`,
          signature: body.signature as `0x${string}`,
        });
        if (!valid) return send({ error: "Wallet proof rejected" }, 403);
        return send(await rpc("wallet_challenge_consume", args));
      }
      return send({ error: "Invalid request" }, 400);
    } catch (error) {
      if (error instanceof SyntaxError)
        return send({ error: "Invalid request" }, 400);
      return send(
        {
          error:
            error instanceof Error && error.message === "rate"
              ? "Too many challenges. Try later."
              : "Wallet proof unavailable. Sign in again or request a fresh challenge.",
        },
        error instanceof Error && error.message === "rate" ? 429 : 403,
      );
    }
  };
}
