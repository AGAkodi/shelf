import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverProvider,
  injectedProvider,
  requestConnection,
} from "../../src/lib/nimiq/provider";
import { walletError } from "../../src/lib/nimiq/errors";
import type { WalletWindow } from "../../src/lib/nimiq/types";
const account = "0x1111111111111111111111111111111111111111";
const target = window as WalletWindow;
const originalEthereum = target.ethereum,
  originalHost = target.nimiqPay;
afterEach(() => {
  target.ethereum = originalEthereum;
  target.nimiqPay = originalHost;
});
describe("Nimiq connection checkpoint", () => {
  it("does not accept an unrelated injected wallet", () => {
    target.ethereum = { request: vi.fn() };
    target.nimiqPay = undefined;
    expect(injectedProvider(target)).toBeUndefined();
  });
  it("discovers a host without prompting and handles delayed injection", () => {
    target.ethereum = undefined;
    target.nimiqPay = undefined;
    const receive = vi.fn(),
      request = vi.fn(),
      stop = discoverProvider(target, receive);
    expect(receive).not.toHaveBeenCalled();
    target.nimiqPay = {};
    target.ethereum = { request };
    window.dispatchEvent(new Event("ethereum#initialized"));
    expect(receive).toHaveBeenCalledWith(target.ethereum);
    expect(request).not.toHaveBeenCalled();
    stop();
    receive.mockClear();
    window.dispatchEvent(new Event("ethereum#initialized"));
    expect(receive).not.toHaveBeenCalled();
  });
  it("accepts only the Nimiq discovery identifier", () => {
    target.ethereum = undefined;
    target.nimiqPay = undefined;
    const receive = vi.fn(),
      provider = { request: vi.fn() },
      stop = discoverProvider(target, receive);
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: { info: { rdns: "other.wallet" }, provider },
      }),
    );
    expect(receive).not.toHaveBeenCalled();
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: { info: { rdns: "com.nimiq.pay" }, provider },
      }),
    );
    expect(receive).toHaveBeenCalledWith(provider);
    stop();
  });
  it("requests permission then reports normalized chain without signing or sending", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([account])
      .mockResolvedValueOnce("0x089");
    expect(await requestConnection({ request })).toEqual({
      account,
      chainId: "0x89",
    });
    expect(request.mock.calls).toEqual([
      [{ method: "eth_requestAccounts" }],
      [{ method: "eth_chainId" }],
    ]);
  });
  it.each([[], ["garbage"], null])(
    "rejects malformed account response %j",
    async (accounts) => {
      await expect(
        requestConnection({ request: vi.fn().mockResolvedValue(accounts) }),
      ).rejects.toThrow("Invalid wallet account");
    },
  );
  it("rejects malformed network response", async () => {
    await expect(
      requestConnection({
        request: vi
          .fn()
          .mockResolvedValueOnce([account])
          .mockResolvedValueOnce("137"),
      }),
    ).rejects.toThrow("Invalid chain");
  });
  it("handles rejection without a second provider request", async () => {
    const request = vi.fn().mockRejectedValue({ code: 4001 });
    await expect(requestConnection({ request })).rejects.toEqual({
      code: 4001,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(walletError({ code: 4001 })).toContain("declined");
    expect(walletError({ code: 4900 })).toContain("disconnected");
    expect(walletError({ code: 4902 })).toContain("Polygon");
    expect(walletError(new Error("secret internals"))).not.toContain("secret");
  });
});
