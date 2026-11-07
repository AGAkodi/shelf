import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";
import type { WalletClient, WalletState } from "../../lib/nimiq/client";
import {
  walletTypedData,
  type WalletChallenge,
} from "../../../shared/wallet-challenge";
import { walletError } from "../../lib/nimiq/errors";
interface Status {
  address: string | null;
  chain_id: number | null;
  session_verified: boolean;
}
export function WalletVerification({
  client,
  state,
}: {
  client: WalletClient;
  state: WalletState;
}) {
  const { supabase } = useServices(),
    { session } = useSession();
  const token = session?.access_token,
    account = state.snapshot?.account,
    chain = state.snapshot?.chainId;
  const key =
    token && account && chain === "0x89"
      ? `${token}:${account.toLowerCase()}`
      : "";
  const current = useRef(key);
  useEffect(() => {
    current.current = key;
  }, [key]);
  const [result, setResult] = useState<{
      key: string;
      status?: Status;
      message?: string;
    }>(),
    [busy, setBusy] = useState(false);
  const api = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<T> => {
      if (!supabase) throw new Error("Sign in unavailable");
      const { data, error } = await supabase.functions.invoke("wallet-auth", {
        body,
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (error || data?.error)
        throw new Error(
          "Wallet verification unavailable. Request a fresh challenge or sign in again.",
        );
      return data as T;
    },
    [supabase, token],
  );
  const previous = useRef({ key: "", token: undefined as string | undefined });
  const invalidating = useRef<Promise<unknown>>(Promise.resolve());
  const operation = useRef(0);
  useEffect(() => {
    const revision = ++operation.current;
    const old = previous.current;
    previous.current = { key, token };
    if (old.key && old.key !== key && old.token === token) {
      invalidating.current = api({ action: "invalidate" });
      void invalidating.current.catch(() => {});
    }
    if (!key) return;
    let live = true;
    void invalidating.current
      .then(() => api<Status>({ action: "status" }))
      .then((status) => {
        if (live && operation.current === revision) setResult({ key, status });
      })
      .catch(() => {
        if (live && operation.current === revision)
          setResult({
            key,
            message:
              "Wallet verification service unavailable. Check your connection.",
          });
      });
    return () => {
      live = false;
    };
  }, [api, key, token]);
  // Outside Nimiq Pay there is no wallet to verify; the parent explains how to open Shelf there.
  if (!state.available) return null;
  if (!session || !supabase)
    return (
      <p className="mt-3">
        Sign in by email before verifying wallet ownership.
      </p>
    );
  if (!key)
    return (
      <p className="mt-3">
        Connect your wallet on Polygon to verify ownership.
      </p>
    );
  const status = result?.key === key ? result.status : undefined;
  async function verify() {
    if (busy || !account) return;
    operation.current++;
    setBusy(true);
    setResult({ key });
    try {
      await invalidating.current.catch(() => {});
      await api({ action: "invalidate" });
      invalidating.current = Promise.resolve();
      if (current.current !== key) throw new Error("Account changed");
      const response = await api<{
        challenge: WalletChallenge;
        secret: string;
      }>({ action: "challenge", address: account, chainId: 137 });
      if (current.current !== key) throw new Error("Account changed");
      const c = response.challenge;
      if (
        c.user_id !== session!.user.id ||
        c.origin !== window.location.origin ||
        c.chain_id !== 137 ||
        c.address.toLowerCase() !== account.toLowerCase()
      )
        throw new Error("Challenge mismatch");
      const signature = await client.signVerification(
        walletTypedData(c),
        account,
      );
      if (current.current !== key) throw new Error("Account changed");
      const verified = await api<Status>({
        action: "verify",
        id: c.id,
        secret: response.secret,
        signature,
      });
      if (current.current === key) setResult({ key, status: verified });
    } catch (cause) {
      if (current.current === key)
        setResult({
          key,
          message:
            typeof cause === "object" && cause !== null && "code" in cause
              ? walletError(cause)
              : "Wallet verification failed or expired. Check your account and retry.",
        });
    } finally {
      setBusy(false);
    }
  }
  const matches = status?.address?.toLowerCase() === account?.toLowerCase();
  return (
    <div className="mt-3">
      {status?.session_verified && matches ? (
        <p role="status">Wallet ownership verified for this Shelf session.</p>
      ) : status?.address && !matches ? (
        <p role="alert">
          This Shelf account is linked to a different wallet. Switch to your
          previously verified wallet.
        </p>
      ) : (
        <>
          <p>
            Approve a one-time ownership signature. It cannot move funds or
            approve spending.
          </p>
          <button
            className="button-primary mt-3"
            disabled={busy || state.busy}
            onClick={() => void verify()}
          >
            {busy ? "Verifying wallet…" : "Verify wallet ownership"}
          </button>
        </>
      )}
      {result?.key === key && result.message && (
        <p role="alert" className="mt-3">
          {result.message}
        </p>
      )}
    </div>
  );
}
