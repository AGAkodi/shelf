import { walletError } from "./errors";
import { readWallet, requestConnection, switchToPolygon } from "./provider";
import type { EvmProvider, WalletSnapshot } from "./types";
export interface WalletState {
  available: boolean;
  busy: boolean;
  snapshot?: WalletSnapshot;
  error?: string;
}
export class WalletClient {
  private provider?: EvmProvider;
  private state: WalletState = { available: false, busy: false };
  private listeners = new Set<() => void>();
  private detach = () => {};
  private epoch = 0;
  private pending = false;
  private refreshing = false;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private publish(state: WalletState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  attach(provider: EvmProvider) {
    if (this.provider === provider) return;
    this.detach();
    this.provider = provider;
    this.epoch++;
    this.publish({ available: true, busy: this.pending });
    const changed = () => {
      if (this.pending) return; // The operation re-reads state after native approval.
      this.epoch++;
      this.publish({
        available: true,
        busy: false,
        error: "Wallet changed. Reconnect to check your account and network.",
      });
    };
    const disconnected = () => {
      this.epoch++;
      this.publish({
        available: true,
        busy: this.pending,
        error: "Wallet disconnected. Reconnect in Nimiq Pay.",
      });
    };
    if (provider.on && provider.removeListener) {
      provider.on("accountsChanged", changed);
      provider.on("chainChanged", changed);
      provider.on("disconnect", disconnected);
      this.detach = () => {
        provider.removeListener?.("accountsChanged", changed);
        provider.removeListener?.("chainChanged", changed);
        provider.removeListener?.("disconnect", disconnected);
      };
    } else this.detach = () => {};
  }
  async connect() {
    await this.run(async (provider) => {
      const granted = await requestConnection(provider);
      const current = await readWallet(provider);
      if (
        !current ||
        current.account.toLowerCase() !== granted.account.toLowerCase()
      )
        throw new Error("Account changed");
      return current;
    });
  }
  async polygon() {
    const account = this.state.snapshot?.account;
    if (account)
      await this.run((provider) => switchToPolygon(provider, account));
  }
  private async run(
    operation: (provider: EvmProvider) => Promise<WalletSnapshot>,
  ) {
    if (this.pending || !this.provider) return;
    this.pending = true;
    const provider = this.provider,
      epoch = ++this.epoch;
    this.publish({ available: true, busy: true });
    // Do not issue another native prompt while this one is unresolved.
    const timer = setTimeout(() => {
      if (this.epoch === epoch)
        this.publish({
          available: true,
          busy: true,
          error:
            "Nimiq Pay is still waiting. Finish or cancel its prompt; do not submit another request.",
        });
    }, 30000);
    try {
      const snapshot = await operation(provider);
      if (this.epoch === epoch)
        this.publish({ available: true, busy: false, snapshot });
    } catch (error) {
      if (this.epoch === epoch)
        this.publish({
          available: true,
          busy: false,
          error: walletError(error),
        });
    } finally {
      clearTimeout(timer);
      this.pending = false;
      if (this.state.busy) this.publish({ ...this.state, busy: false });
    }
  }
  async refresh() {
    if (
      this.pending ||
      this.refreshing ||
      !this.provider ||
      !this.state.snapshot
    )
      return;
    this.refreshing = true;
    const epoch = this.epoch,
      old = this.state.snapshot;
    try {
      const current = await readWallet(this.provider);
      if (epoch !== this.epoch) return;
      if (
        !current ||
        current.account.toLowerCase() !== old.account.toLowerCase() ||
        current.chainId !== old.chainId
      ) {
        this.epoch++;
        this.publish({
          available: true,
          busy: false,
          error: "Wallet changed. Reconnect to check your account and network.",
        });
      }
    } catch {
      if (epoch === this.epoch) {
        this.epoch++;
        this.publish({
          available: true,
          busy: false,
          error:
            "Wallet status could not be checked. Reconnect before continuing.",
        });
      }
    } finally {
      this.refreshing = false;
    }
  }

  async signVerification(typedData: unknown, account: string): Promise<string> {
    if (this.pending || !this.provider)
      throw new Error("Wallet request already pending");
    this.pending = true;
    const provider = this.provider,
      epoch = ++this.epoch,
      snapshot = this.state.snapshot;
    this.publish({ available: true, busy: true, snapshot });
    const guard = () => {
      if (this.epoch !== epoch || this.provider !== provider)
        throw new Error("Wallet changed");
    };
    let accountStillMatches = false;
    const matching = async () => {
      accountStillMatches = false;
      const current = await readWallet(provider);
      guard();
      if (
        !current ||
        current.account.toLowerCase() !== account.toLowerCase() ||
        current.chainId !== "0x89"
      )
        throw new Error("Polygon account changed");
      accountStillMatches = true;
    };
    try {
      await matching();
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(typedData)],
      });
      await matching();
      if (
        typeof signature !== "string" ||
        !/^0x[0-9a-f]{130}$/i.test(signature)
      )
        throw new Error("Invalid signature");
      return signature;
    } finally {
      this.pending = false;
      if (this.epoch === epoch)
        this.publish({ available: true, busy: false, snapshot: accountStillMatches ? snapshot : undefined });
      else if (this.state.busy) this.publish({ ...this.state, busy: false });
    }
  }
  dispose() {
    this.epoch++;
    this.detach();
    this.provider = undefined;
  }
}
