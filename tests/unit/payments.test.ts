import { expect, it, vi } from "vitest";
import { decodeFunctionData, erc20Abi } from "viem";
import { sendUsdt, USDT_CONTRACT } from "../../src/lib/nimiq/payments";
const account = "0x1111111111111111111111111111111111111111",
  recipient = "0x2222222222222222222222222222222222222222";
const quote = {
  expected_sender: account,
  recipient,
  chain_id: 137,
  token_contract: USDT_CONTRACT,
  gross_amount: "2000000",
};
it("sends exact quoted ERC20 calldata with no native value", async () => {
  const request = vi.fn(async ({ method }: { method: string }) =>
    method === "eth_accounts"
      ? [account]
      : method === "eth_chainId"
      ? "0x89"
      : `0x${"ab".repeat(32)}`
  );
  await sendUsdt({ request }, quote);
  const call = request.mock.calls.find(([a]) =>
    a.method === "eth_sendTransaction"
  )![0] as unknown as {
    params: { to: string; value: string; data: `0x${string}` }[];
  };
  expect(call.params[0].to).toBe(USDT_CONTRACT);
  expect(call.params[0].value).toBe("0x0");
  expect(decodeFunctionData({ abi: erc20Abi, data: call.params[0].data }))
    .toMatchObject({ functionName: "transfer", args: [recipient, 2000000n] });
});
it("passes the estimated gas limit to the wallet transaction", async () => {
  const request = vi.fn(async ({method}:{method:string}) => method==="eth_accounts" ? [account] : method==="eth_chainId" ? "0x89" : `0x${"ab".repeat(32)}`);
  await sendUsdt({request},quote,72000n);
  const call=request.mock.calls.find(([args])=>args.method==="eth_sendTransaction")![0] as unknown as {params:[{gas:string}]};
  expect(call.params[0].gas).toBe("0x11940");
});
it("does not prompt for a different wallet or network", async () => {
  const request = vi.fn(async ({ method }: { method: string }) =>
    method === "eth_accounts" ? [recipient] : "0x1"
  );
  await expect(sendUsdt({ request }, quote)).rejects.toThrow();
  expect(request.mock.calls.some(([a]) => a.method === "eth_sendTransaction"))
    .toBe(false);
});
import { preflightUsdt, PreflightError } from "../../src/lib/nimiq/payments";
function wallet(over: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    eth_accounts: [account],
    eth_chainId: "0x89",
    eth_call: "0x" + (5000000n).toString(16).padStart(64, "0"), // 5 USDT
    eth_getBalance: "0x" + (10n ** 17n).toString(16), // 0.1 POL
    eth_gasPrice: "0x" + (30n * 10n ** 9n).toString(16), // 30 gwei
    eth_estimateGas: "0xea60", // 60k gas
    ...over,
  };
  return vi.fn(async ({ method }: { method: string }) => {
    const v = values[method];
    if (v instanceof Error) throw v;
    if (v === undefined) throw new Error("Unexpected " + method);
    return v;
  });
}
it("preflight passes with enough USDT and POL, using only read-only calls", async () => {
  const request = wallet();
  expect(await preflightUsdt({ request }, quote)).toBe(72000n);
  const methods = request.mock.calls.map(([a]) => a.method);
  expect(methods).not.toContain("eth_sendTransaction");
  expect(methods).not.toContain("eth_requestAccounts");
  expect(methods).not.toContain("wallet_switchEthereumChain");
  const call = request.mock.calls.find(([a]) => a.method === "eth_call")![0] as unknown as { params: [{ to: string; data: `0x${string}` }] };
  expect(call.params[0].to).toBe(USDT_CONTRACT);
  expect(decodeFunctionData({ abi: erc20Abi, data: call.params[0].data })).toMatchObject({ functionName: "balanceOf", args: [account] });
});
it("uses the server balance only if the wallet balance request fails", async () => {
  const fallback = vi.fn(async () => "0x" + (5000000n).toString(16).padStart(64, "0"));
  await preflightUsdt({ request: wallet({eth_call: new Error("unavailable")}) }, quote, fallback);
  expect(fallback).toHaveBeenCalledOnce();
  await expect(preflightUsdt({request:wallet({eth_call:new Error("unavailable")})}, quote, async () => "0x01"))
    .rejects.toThrow("Not enough USDT");
  await expect(preflightUsdt({request:wallet({eth_call:new Error("unavailable")})}, quote, async () => {throw new Error("offline")}))
    .rejects.toThrow("USDT balance");
});
it("uses server checks if the wallet cannot read POL, gas price or gas estimate", async () => {
  const fallback = vi.fn(async (check: "pol" | "gasPrice" | "gas") => ({
    pol: "0x16345785d8a0000", gasPrice: "0x6fc23ac00", gas: "0xea60",
  })[check]);
  await preflightUsdt({request:wallet({
    eth_getBalance:new Error("offline"),eth_gasPrice:new Error("offline"),eth_estimateGas:new Error("offline"),
  })},quote,undefined,fallback);
  expect(fallback.mock.calls.map(([check])=>check)).toEqual(["pol","gasPrice","gas"]);
  await expect(preflightUsdt({request:wallet({eth_getBalance:new Error("offline")})},quote,undefined,async()=> "0x1"))
    .rejects.toThrow("Not enough POL");
});
it.each([
  ["not enough USDT", { eth_call: "0x" + (1n).toString(16).padStart(64, "0") }, /Not enough USDT/],
  ["not enough POL", { eth_getBalance: "0x1" }, /Not enough POL/],
  ["gas estimate unavailable", { eth_estimateGas: new Error("offline") }, /estimate the transfer fee/],
  ["gas price unavailable", { eth_gasPrice: new Error("offline") }, /network gas price/],
  ["POL lookup unavailable", { eth_getBalance: new Error("offline") }, /POL balance/],
  ["malformed balance", { eth_call: "nonsense" }, /USDT balance/],
  ["wrong network", { eth_chainId: "0x1" }, /Polygon/],
])("preflight stops before any prompt: %s", async (_name, over, message) => {
  const request = wallet(over);
  const result = preflightUsdt({ request }, quote);
  await expect(result).rejects.toBeInstanceOf(PreflightError);
  await expect(preflightUsdt({ request: wallet(over) }, quote)).rejects.toThrow(message);
});
