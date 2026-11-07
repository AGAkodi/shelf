import { useEffect } from "react";
import { discoverProvider } from "../../lib/nimiq/provider";
import { walletClient } from "../../lib/nimiq/wallet";

/**
 * Owns Nimiq Pay provider discovery for the whole app. Mounted once in the layout so the wallet
 * connection survives navigation between Account and Checkout. Never requests accounts or
 * prompts the user; it only attaches the injected provider and refreshes read-only state.
 */
export function useWalletDiscovery() {
  useEffect(() => {
    const client = walletClient;
    const stop = discoverProvider(window, (provider) => client.attach(provider));
    const refresh = () => {
      if (document.visibilityState === "visible") void client.refresh();
    };
    const poll = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stop();
      window.clearInterval(poll);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      client.dispose();
    };
  }, []);
}
