import { WalletVerification } from "./WalletVerification";
import { useEffect, useState, useSyncExternalStore } from "react";
import { POLYGON_CHAIN_ID } from "../../lib/nimiq/provider";
import { walletClient } from "../../lib/nimiq/wallet";

/** Wallet panel UI. Provider discovery itself lives in useWalletDiscovery (mounted in the layout). */
export function WalletConnection({ compact = false }: { compact?: boolean }) {
  const client = walletClient;
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
              disabled={state.busy}
              onClick={() => void client.connect()}
            >
              {state.busy ? "Waiting for Nimiq Pay…" : "Connect Nimiq Pay"}
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
      {state.error && (
        <p role="alert" className="mt-3">
          {state.error}
        </p>
      )}
    </section>
  );
}
