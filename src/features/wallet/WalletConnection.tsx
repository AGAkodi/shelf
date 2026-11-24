import { WalletVerification } from "./WalletVerification";
import { useEffect, useState, useSyncExternalStore } from "react";
import { POLYGON_CHAIN_ID } from "../../lib/nimiq/provider";
import { walletClient } from "../../lib/nimiq/wallet";
import { useServices } from "../../app/services";
import { useSession } from "../borrowing/session";

/** Wallet panel UI. Provider discovery itself lives in useWalletDiscovery (mounted in the layout). */
export function WalletConnection({ compact = false }: { compact?: boolean }) {
  const client = walletClient;
  const {supabase} = useServices();
  const {session} = useSession();
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState("");
  async function disconnect() {
    if (disconnecting || state.busy) return;
    setDisconnecting(true);
    setDisconnectError("");
    try {
      if (session) {
        if (!supabase) throw new Error("Sign-in service unavailable");
        const result = await supabase.functions.invoke("wallet-auth", {
          body: {action:"invalidate"},
          headers: {Authorization:`Bearer ${session.access_token}`},
        });
        if (result.error || result.data?.error) throw new Error("Could not disconnect");
      }
      client.disconnect();
    } catch {
      setDisconnectError("Could not disconnect safely. Check your connection and try again.");
    } finally {
      setDisconnecting(false);
    }
  }
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearched(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section className="account-panel" aria-label="Nimiq Pay connection">
      {!compact && <strong>Nimiq Pay wallet</strong>}
      {!state.available ? (
        !searched ? (
          <p role="status">Looking for Nimiq Pay…</p>
        ) : (
          <p>
            Open Shelf from Mini Apps inside Nimiq Pay to connect. You can still
            browse here.
          </p>
        )
      ) : (
        <>
          <p>
            Connect your wallet, then select Polygon. No funds move during this
            step.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="button-secondary"
              disabled={state.busy || disconnecting}
              onClick={() => state.snapshot ? void disconnect() : void client.connect()}
            >
              {disconnecting ? "Disconnecting…" : state.busy ? "Waiting for Nimiq Pay…" : state.snapshot ? "Disconnect wallet" : "Connect Nimiq Pay"}
            </button>
            {state.snapshot && state.snapshot.chainId !== POLYGON_CHAIN_ID && (
              <button
                className="button-primary"
                disabled={state.busy}
                onClick={() => void client.polygon()}
              >
                Switch to Polygon
              </button>
            )}
          </div>
        </>
      )}
      {state.snapshot && (
        <div role="status" className="mt-3">
          <p className="break-all tx-hash">Account: {state.snapshot.account}</p>
          <p>
            Network:{" "}
            {state.snapshot.chainId === POLYGON_CHAIN_ID
              ? "Polygon (137)"
              : `Chain ${BigInt(state.snapshot.chainId).toString()}`}
          </p>
          <p>
            Account permission received. Ownership is verified as a separate
            step.
          </p>
        </div>
      )}
      <WalletVerification client={client} state={state} />
      {disconnectError && <p role="alert">{disconnectError}</p>}
      {state.error && (
        <p role="alert" className="mt-3">
          {state.error}
        </p>
      )}
    </section>
  );
}
