import type { EvmProvider, WalletSnapshot, WalletWindow } from "./types";
export const POLYGON_CHAIN_ID = "0x89";
export function isProvider(value: unknown): value is EvmProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "request" in value &&
    typeof value.request === "function"
  );
}
export function injectedProvider(
  target: WalletWindow,
): EvmProvider | undefined {
  return typeof target.nimiqPay === "object" &&
    target.nimiqPay !== null &&
    isProvider(target.ethereum)
    ? target.ethereum
    : undefined;
}
// Listen before requesting announcements; older hosts can use the injected context.
export function discoverProvider(
  target: WalletWindow,
  receive: (provider: EvmProvider) => void,
): () => void {
  const inspect = () => {
    const provider = injectedProvider(target);
    if (provider) receive(provider);
  };
  const announce = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (
      !detail ||
      typeof detail !== "object" ||
      !("info" in detail) ||
      !("provider" in detail)
    )
      return;
    const info = detail.info;
    if (
      info &&
      typeof info === "object" &&
      "rdns" in info &&
      info.rdns === "com.nimiq.pay" &&
      isProvider(detail.provider)
    )
      receive(detail.provider);
  };
  target.addEventListener("eip6963:announceProvider", announce);
  target.addEventListener("ethereum#initialized", inspect);
  inspect();
  target.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => {
    target.removeEventListener("eip6963:announceProvider", announce);
    target.removeEventListener("ethereum#initialized", inspect);
  };
}
export async function requestConnection(
  provider: EvmProvider,
): Promise<WalletSnapshot> {
  // Only call from explicit user intent. No signatures or transactions in this probe.
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    !/^0x[0-9a-f]{40}$/i.test(accounts[0])
  )
    throw new Error("Invalid wallet account");
  const chain = await provider.request({ method: "eth_chainId" });
  if (
    typeof chain !== "string" ||
    !/^0x[0-9a-f]+$/i.test(chain) ||
    BigInt(chain) <= 0n
  )
    throw new Error("Invalid chain");
  return { account: accounts[0], chainId: `0x${BigInt(chain).toString(16)}` };
}

export async function readWallet(
  provider: EvmProvider,
): Promise<WalletSnapshot | undefined> {
  const accounts = await provider.request({ method: "eth_accounts" });
  if (Array.isArray(accounts) && accounts.length === 0) return undefined;
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    !/^0x[0-9a-f]{40}$/i.test(accounts[0])
  )
    throw new Error("Invalid wallet account");
  const chain = await provider.request({ method: "eth_chainId" });
  if (
    typeof chain !== "string" ||
    !/^0x[0-9a-f]+$/i.test(chain) ||
    BigInt(chain) <= 0n
  )
    throw new Error("Invalid chain");
  return { account: accounts[0], chainId: `0x${BigInt(chain).toString(16)}` };
}
export async function switchToPolygon(
  provider: EvmProvider,
  account: string,
): Promise<WalletSnapshot> {
  const before = await readWallet(provider);
  if (!before || before.account.toLowerCase() !== account.toLowerCase())
    throw new Error("Wallet account changed");
  if (before.chainId !== POLYGON_CHAIN_ID)
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_CHAIN_ID }],
    });
  const after = await readWallet(provider);
  if (
    !after ||
    after.account.toLowerCase() !== account.toLowerCase() ||
    after.chainId !== POLYGON_CHAIN_ID
  )
    throw new Error("Wallet changed or Polygon switch incomplete");
  return after;
}
