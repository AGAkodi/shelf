import { encodeFunctionData, erc20Abi } from "viem";
import { readWallet } from "./provider";
import type { EvmProvider } from "./types";
export const USDT_CONTRACT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
export type PaymentQuote = {
  expected_sender: string;
  recipient: string;
  token_contract: string;
  chain_id: number;
  gross_amount: string;
};
export async function sendUsdt(
  provider: EvmProvider,
  quote: PaymentQuote,
): Promise<string> {
  if (
    quote.chain_id !== 137 ||
    quote.token_contract.toLowerCase() !== USDT_CONTRACT ||
    !/^0x[0-9a-f]{40}$/i.test(quote.recipient) ||
    !/^\d+$/.test(quote.gross_amount) || BigInt(quote.gross_amount) <= 0n
  ) throw new Error("Invalid quote");
  const current = await readWallet(provider);
  if (
    current?.chainId !== "0x89" ||
    current.account.toLowerCase() !== quote.expected_sender.toLowerCase()
  ) throw new Error("Reconnect the quoted Polygon wallet");
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [quote.recipient as `0x${string}`, BigInt(quote.gross_amount)],
  });
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: current.account, to: USDT_CONTRACT, data, value: "0x0" }],
  });
  // A hash is submission only. Do not discard it if the account changed during the prompt.
  if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) {
    throw new Error("Unknown transaction outcome");
  }
  return hash.toLowerCase();
}
