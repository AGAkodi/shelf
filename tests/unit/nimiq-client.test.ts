import { afterEach, expect, it, vi } from "vitest";
import { WalletClient } from "../../src/lib/nimiq/client";
import { switchToPolygon } from "../../src/lib/nimiq/provider";
import type { EvmProvider } from "../../src/lib/nimiq/types";
const account = "0x1111111111111111111111111111111111111111";
function fixture() {
  let chain = "0x1",
    accounts = [account];
  const events = new Map<string, (...args: unknown[]) => void>();
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return accounts;
    if (method === "eth_chainId") return chain;
    if (method === "wallet_switchEthereumChain") {
      chain = "0x89";
      return null;
    }
    throw new Error("Unexpected method");
  });
  const provider: EvmProvider = {
    request,
    on: (event, fn) => events.set(event, fn),
    removeListener: (event) => events.delete(event),
  };
  return {
    provider,
    request,
    events,
    setAccounts: (next: string[]) => {
      accounts = next;
    },
    setChain: (next: string) => {
      chain = next;
    },
  };
}
afterEach(() => vi.useRealTimers());
it("switches Polygon on explicit action and verifies resulting account and chain", async () => {
  const f = fixture();
  expect(await switchToPolygon(f.provider, account)).toEqual({
    account,
    chainId: "0x89",
  });
  expect(f.request).toHaveBeenCalledWith({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0x89" }],
  });
});
it("does not switch when the account no longer matches", async () => {
  const f = fixture();
  f.setAccounts(["0x2222222222222222222222222222222222222222"]);
  await expect(switchToPolygon(f.provider, account)).rejects.toThrow(
    "account changed",
  );
  expect(
    f.request.mock.calls.some(
      ([a]) => a.method === "wallet_switchEthereumChain",
    ),
  ).toBe(false);
});
it("rejects a wallet claiming success without changing network", async () => {
  const f = fixture();
  const original = f.provider.request;
  f.provider.request = async (args) =>
    args.method === "wallet_switchEthereumChain" ? null : original(args);
  await expect(switchToPolygon(f.provider, account)).rejects.toThrow(
    "switch incomplete",
  );
});
it("attaching does not prompt; account events clear previous state", async () => {
  const f = fixture(),
    client = new WalletClient();
  client.attach(f.provider);
  expect(f.request).not.toHaveBeenCalled();
  await client.connect();
  expect(client.getSnapshot().snapshot?.account).toBe(account);
  f.events.get("accountsChanged")?.([]);
  expect(client.getSnapshot().snapshot).toBeUndefined();
  expect(client.getSnapshot().error).toContain("changed");
  client.dispose();
  expect(f.events.size).toBe(0);
});
it("polling catches account changes without event support", async () => {
  const f = fixture(),
    client = new WalletClient();
  client.attach({ request: f.request });
  await client.connect();
  f.setAccounts([]);
  await client.refresh();
  expect(client.getSnapshot().snapshot).toBeUndefined();
  client.dispose();
});
it("double click creates one permission prompt and disconnect discards late success", async () => {
  const f = fixture(),
    client = new WalletClient();
  let approve!: (value: unknown) => void;
  const original = f.provider.request;
  f.provider.request = vi.fn((args) =>
    args.method === "eth_requestAccounts"
      ? new Promise((resolve) => {
          approve = resolve;
        })
      : original(args),
  );
  client.attach(f.provider);
  const pending = client.connect();
  await client.connect();
  expect(f.provider.request).toHaveBeenCalledTimes(1);
  f.events.get("disconnect")?.();
  approve([account]);
  await pending;
  expect(client.getSnapshot().snapshot).toBeUndefined();
  expect(client.getSnapshot().busy).toBe(false);
  client.dispose();
});
it("chain rejection remains retryable without corrupting account state", async () => {
  const f = fixture(),
    client = new WalletClient();
  const original = f.provider.request;
  client.attach(f.provider);
  await client.connect();
  f.provider.request = (args) =>
    args.method === "wallet_switchEthereumChain"
      ? Promise.reject({ code: 4001 })
      : original(args);
  await client.polygon();
  expect(client.getSnapshot().error).toContain("declined");
  expect(client.getSnapshot().busy).toBe(false);
  f.provider.request = original;
  await client.connect();
  await client.polygon();
  expect(client.getSnapshot().snapshot?.chainId).toBe("0x89");
  client.dispose();
});
it("slow native prompt never unlocks a second prompt", async () => {
  vi.useFakeTimers();
  const client = new WalletClient();
  let reject!: (cause: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise((_, no) => {
        reject = no;
      }),
  );
  client.attach({ request });
  const pending = client.connect();
  await vi.advanceTimersByTimeAsync(30000);
  expect(client.getSnapshot().busy).toBe(true);
  expect(client.getSnapshot().error).toContain("still waiting");
  await client.connect();
  expect(request).toHaveBeenCalledTimes(1);
  reject({ code: 4001 });
  await pending;
  expect(client.getSnapshot().busy).toBe(false);
  client.dispose();
});

it("clears the account when it changes during a signature request", async () => {
  const f = fixture(), client = new WalletClient();
  f.setChain("0x89");
  const original = f.provider.request;
  f.provider.request = async (args) => {
    if (args.method === "eth_signTypedData_v4") {
      f.setAccounts(["0x2222222222222222222222222222222222222222"]);
      return `0x${"11".repeat(65)}`;
    }
    return original(args);
  };
  client.attach(f.provider);
  await client.connect();
  await expect(client.signVerification({}, account)).rejects.toThrow("account changed");
  expect(client.getSnapshot().snapshot).toBeUndefined();
  expect(client.getSnapshot().busy).toBe(false);
  client.dispose();
});
