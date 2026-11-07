import { WalletVerification } from "./WalletVerification";
import { useEffect, useState, useSyncExternalStore } from "react";
import { discoverProvider, POLYGON_CHAIN_ID } from "../../lib/nimiq/provider";
import { walletClient } from "../../lib/nimiq/wallet";
export function WalletConnection() {
  const client = walletClient;
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    const stop = discoverProvider(window, (provider) =>
      client.attach(provider),
    );
    const timer = window.setTimeout(() => setSearched(true), 1500);
    const refresh = () => {
      if (document.visibilityState === "visible") void client.refresh();
    };
    const poll = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stop();
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      client.dispose();
    };
  }, [client]);
  return (
    <section className="config-notice" aria-label="Nimiq Pay connection">
      <strong>Nimiq Pay connection</strong>
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
          <p className="break-all">Account: {state.snapshot.account}</p>
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
