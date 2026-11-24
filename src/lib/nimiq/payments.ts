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
/** A check that stopped the payment before any wallet prompt. Its message is safe to show. */
export class PreflightError extends Error {}
const quantity = (value: unknown): bigint => {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new PreflightError(
      "Shelf could not check your wallet balance. Try again in a moment.",
    );
  }
  return BigInt(value);
};
/**
 * Read-only checks before reserving a wallet prompt: enough USDT for the quote and enough POL for
 * the estimated gas. These calls need no approval. They reduce, but do not replace, the server's
 * handling of failed prompts; the server never trusts this result.
 */
export async function preflightUsdt(
  provider: EvmProvider,
  quote: PaymentQuote,
): Promise<void> {
  const current = await readWallet(provider);
  if (
    current?.chainId !== "0x89" ||
    current.account.toLowerCase() !== quote.expected_sender.toLowerCase()
  ) throw new PreflightError("Reconnect the quoted wallet on Polygon.");
  const amount = BigInt(quote.gross_amount);
  const transfer = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [quote.recipient as `0x${string}`, amount],
  });
  const balanceCall = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [current.account as `0x${string}`],
  });
  async function readCheck(method: string, params: unknown[], label: string) {
    try {
      return quantity(await provider.request({ method, params }));
    } catch {
      throw new PreflightError(`Shelf could not check ${label} on Polygon. Reconnect your wallet and try again.`);
    }
  }
  const usdt = await readCheck("eth_call", [{ to: USDT_CONTRACT, data: balanceCall }, "latest"], "your USDT balance");
  if (usdt < amount) {
    throw new PreflightError(
      "Not enough USDT on Polygon for this rental. Top up USDT on Polygon, then try again.",
    );
  }
  const pol = await readCheck("eth_getBalance", [current.account, "latest"], "your POL balance");
  const price = await readCheck("eth_gasPrice", [], "the network gas price");
  let gas: unknown;
  try {
    gas = await provider.request({
      method: "eth_estimateGas",
      params: [{ from: current.account, to: USDT_CONTRACT, data: transfer, value: "0x0" }],
    });
  } catch {
    throw new PreflightError(
      "Shelf could not estimate the transfer fee on Polygon. Reconnect your wallet and try again.",
    );
  }
  if (quantity(gas) * price > pol) {
    throw new PreflightError(
      "Not enough POL for network gas. Add a little POL on Polygon, then try again.",
    );
  }
}
