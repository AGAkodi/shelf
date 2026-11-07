import { decodeEventLog, decodeFunctionData, erc20Abi } from "npm:viem@2.57.14";
export const TOKEN = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
export type Quote = {
  expected_sender: string;
  recipient: string;
  token_contract: string;
  chain_id: number;
  gross_amount: string;
  quote_block_number: string;
  created_at: string;
};
export type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
type Block = { number: string; hash: string; timestamp: string };
type Transaction = {
  hash: string;
  from: string;
  to: string;
  input: string;
  value: string;
  blockNumber: string | null;
  blockHash: string | null;
  chainId?: string;
};
type Receipt = {
  transactionHash: string;
  from: string;
  to: string;
  status: string;
  blockNumber: string;
  blockHash: string;
  logs: {
    address: string;
    topics: string[];
    data: string;
    removed?: boolean;
    transactionHash: string;
    blockHash: string;
  }[];
};
const same = (a: unknown, b: unknown) =>
  typeof a === "string" && typeof b === "string" &&
  a.toLowerCase() === b.toLowerCase();
export function rpcClient(url: string): Rpc {
  if (new URL(url).protocol !== "https:") {
    throw new Error("HTTPS Polygon RPC required");
  }
  return async (method, params) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!r.ok) throw new Error("RPC unavailable");
    const body = await r.json();
    if (body.error || !("result" in body)) throw new Error("RPC unavailable");
    return body.result;
  };
}
export async function chainBaseline(rpc: Rpc) {
  const [chain, code, decimals, latest, finalized] = await Promise.all([
    rpc("eth_chainId", []),
    rpc("eth_getCode", [TOKEN, "latest"]),
    rpc("eth_call", [{ to: TOKEN, data: "0x313ce567" }, "latest"]),
    rpc("eth_getBlockByNumber", ["latest", false]),
    rpc("eth_getBlockByNumber", ["finalized", false]),
  ]);
  if (
    chain !== "0x89" || typeof code !== "string" ||
    !/^0x[0-9a-f]+$/i.test(code) || code === "0x0" ||
    BigInt(String(decimals)) !== 6n
  ) throw new Error("Polygon token configuration unavailable");
  const head = latest as Block, final = finalized as Block;
  if (
    !head?.number || !final?.number ||
    BigInt(final.number) > BigInt(head.number)
  ) throw new Error("Finality unavailable");
  return BigInt(head.number).toString();
}
export async function verifyTransfer(rpc: Rpc, q: Quote, hash: string) {
  const invalid = () => {
    throw new Error("Transfer does not match this checkout");
  };
  if (
    !/^0x[0-9a-f]{64}$/i.test(hash) || q.chain_id !== 137 ||
    !same(q.token_contract, TOKEN)
  ) invalid();
  if (await rpc("eth_chainId", []) !== "0x89") {
    throw new Error("RPC network mismatch");
  }
  const [rawTx, rawReceipt] = await Promise.all([
    rpc("eth_getTransactionByHash", [hash]),
    rpc("eth_getTransactionReceipt", [hash]),
  ]);
  if (!rawTx || !rawReceipt) return null;
  const tx = rawTx as Transaction, r = rawReceipt as Receipt;
  if (!tx.blockNumber) return null;
  if (
    !same(tx.hash, hash) || !same(r.transactionHash, hash) ||
    !same(tx.from, q.expected_sender) || !same(r.from, q.expected_sender) ||
    !same(tx.to, TOKEN) || !same(r.to, TOKEN) || BigInt(tx.value) !== 0n ||
    !["0x1", "0x0"].includes(r.status) ||
    (tx.chainId && BigInt(tx.chainId) !== 137n)
  ) invalid();
  const call = decodeFunctionData({
    abi: erc20Abi,
    data: tx.input as `0x${string}`,
  });
  if (
    call.functionName !== "transfer" || !same(call.args?.[0], q.recipient) ||
    String(call.args?.[1]) !== q.gross_amount
  ) invalid();
  // Require exact calldata, without trailing bytes or an alternate call path.
  if (tx.input.length !== 138) invalid();
  if (
    BigInt(r.blockNumber) <= BigInt(q.quote_block_number) ||
    tx.blockNumber !== r.blockNumber || !same(tx.blockHash, r.blockHash)
  ) invalid();
  const matching = r.logs.filter((log) => {
    if (
      !same(log.address, TOKEN) || log.removed ||
      !same(log.transactionHash, hash) || !same(log.blockHash, r.blockHash)
    ) return false;
    try {
      const e = decodeEventLog({
        abi: erc20Abi,
        eventName: "Transfer",
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data as `0x${string}`,
        strict: true,
      });
      return same(e.args.from, q.expected_sender) &&
        same(e.args.to, q.recipient) && String(e.args.value) === q.gross_amount;
    } catch {
      return false;
    }
  });
  if (r.status === "0x1" && matching.length !== 1) invalid();
  const [canonical, finalized] = await Promise.all([
    rpc("eth_getBlockByNumber", [r.blockNumber, false]),
    rpc("eth_getBlockByNumber", ["finalized", false]),
  ]) as [Block, Block];
  if (
    !canonical || !finalized || !same(canonical.hash, r.blockHash) ||
    canonical.number !== r.blockNumber
  ) return null;
  if (BigInt(finalized.number) < BigInt(r.blockNumber)) return null;
  const time = Number(BigInt(canonical.timestamp)) * 1000;
  if (
    !Number.isSafeInteger(time) || time < Date.parse(q.created_at) ||
    time > Date.now()
  ) invalid();
  const recheck = await rpc("eth_getBlockByNumber", [
    r.blockNumber,
    false,
  ]) as Block;
  if (!same(recheck?.hash, r.blockHash)) return null;
  return {
    success: r.status === "0x1",
    hash: hash.toLowerCase(),
    block: BigInt(r.blockNumber).toString(),
    blockHash: r.blockHash.toLowerCase(),
    time: new Date(time).toISOString(),
    finalized: BigInt(finalized.number).toString(),
  };
}

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const RELEASE_MAX_BLOCKS = 50_000n;
const LOG_CHUNK = 5_000n;
const topicAddress = (a: string) => "0x" + "0".repeat(24) + a.slice(2).toLowerCase();
/**
 * Evidence that a prompted wallet request never produced a transfer, so the reader may start over.
 * Conservative: any pending sender transaction or any USDT Transfer from the quoted sender to the
 * recipient after the quote block (of any amount) denies release. RPC failure, wrong chain or a
 * search range beyond RELEASE_MAX_BLOCKS throws, which also denies release.
 */
export async function noTransferSince(rpc: Rpc, q: Quote): Promise<boolean> {
  if (await rpc("eth_chainId", []) !== "0x89") throw new Error("Wrong chain");
  const [latestHex, pending, mined] = await Promise.all([
    rpc("eth_blockNumber", []),
    rpc("eth_getTransactionCount", [q.expected_sender, "pending"]),
    rpc("eth_getTransactionCount", [q.expected_sender, "latest"]),
  ]);
  if (typeof latestHex !== "string" || typeof pending !== "string" || typeof mined !== "string") {
    throw new Error("Malformed RPC response");
  }
  if (BigInt(pending) !== BigInt(mined)) return false;
  const latest = BigInt(latestHex);
  const from = BigInt(q.quote_block_number) + 1n;
  if (latest < from) return true;
  if (latest - from > RELEASE_MAX_BLOCKS) throw new Error("Search range too large");
  for (let start = from; start <= latest; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n < latest ? start + LOG_CHUNK - 1n : latest;
    const logs = await rpc("eth_getLogs", [{
      address: TOKEN,
      topics: [TRANSFER_TOPIC, topicAddress(q.expected_sender), topicAddress(q.recipient)],
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
    }]);
    if (!Array.isArray(logs)) throw new Error("Malformed RPC response");
    if (logs.length > 0) return false;
  }
  return true;
}
