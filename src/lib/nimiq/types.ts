export interface EvmProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener?(
    event: string,
    listener: (...args: unknown[]) => void,
  ): unknown;
}
export interface WalletSnapshot {
  account: string;
  chainId: string;
}
// Host markers guide UX only; they are never authentication evidence.
export type WalletWindow = Window & { ethereum?: unknown; nimiqPay?: unknown };
