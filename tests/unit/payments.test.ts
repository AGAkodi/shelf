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
it("does not prompt for a different wallet or network", async () => {
  const request = vi.fn(async ({ method }: { method: string }) =>
    method === "eth_accounts" ? [recipient] : "0x1"
  );
  await expect(sendUsdt({ request }, quote)).rejects.toThrow();
  expect(request.mock.calls.some(([a]) => a.method === "eth_sendTransaction"))
    .toBe(false);
});
