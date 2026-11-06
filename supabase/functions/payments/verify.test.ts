import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  erc20Abi,
} from "npm:viem@2.57.14";
import { type Rpc, TOKEN, verifyTransfer } from "./verify.ts";
const sender = "0x1111111111111111111111111111111111111111",
  recipient = "0x2222222222222222222222222222222222222222";
const hash = `0x${"aa".repeat(32)}`, blockHash = `0x${"bb".repeat(32)}`;
function fixture() {
  const now = Math.floor(Date.now() / 1000) - 10;
  const quote = {
    expected_sender: sender,
    recipient,
    token_contract: TOKEN,
    chain_id: 137,
    gross_amount: "2000000",
    quote_block_number: "100",
    created_at: new Date((now - 10) * 1000).toISOString(),
  };
  const tx = {
    hash,
    from: sender,
    to: TOKEN,
    input: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, 2000000n],
    }),
    value: "0x0",
    chainId: "0x89",
    blockNumber: "0x65",
    blockHash,
  };
  const receipt = {
    transactionHash: hash,
    from: sender,
    to: TOKEN,
    status: "0x1",
    blockNumber: "0x65",
    blockHash,
    logs: [{
      address: TOKEN,
      transactionHash: hash,
      blockHash,
      topics: encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: { from: sender, to: recipient },
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [2000000n]),
      removed: false,
    }],
  };
  let chain = "0x89",
    finalized = "0x66",
    canonical = blockHash,
    missing = false;
  const rpc: Rpc = async (method, params) => {
    if (method === "eth_chainId") return chain;
    if (method === "eth_getTransactionByHash") return tx;
    if (method === "eth_getTransactionReceipt") return missing ? null : receipt;
    if (method === "eth_getBlockByNumber") {
      return {
        number: params[0] === "finalized" ? finalized : "0x65",
        hash: canonical,
        timestamp: `0x${now.toString(16)}`,
      };
    }
    throw new Error("Unexpected RPC");
  };
  return {
    quote,
    tx,
    receipt,
    rpc,
    chain: (v: string) => chain = v,
    finalized: (v: string) => finalized = v,
    canonical: (v: string) => canonical = v,
    missing: () => missing = true,
  };
}
Deno.test("exact finalized transfer verifies", async () => {
  const f = fixture();
  const r = await verifyTransfer(f.rpc, f.quote, hash);
  if (r?.block !== "101" || r.hash !== hash) {
    throw new Error("Missing evidence");
  }
});
for (
  const [name, change] of Object.entries({
    "wrong chain": (f: ReturnType<typeof fixture>): void => {
      f.chain("0x1");
    },
    "wrong sender": (f: ReturnType<typeof fixture>): void => {
      f.tx.from = recipient;
    },
    "wrong recipient": (f: ReturnType<typeof fixture>): void => {
      f.quote.recipient = sender;
    },
    "wrong amount": (f: ReturnType<typeof fixture>): void => {
      f.quote.gross_amount = "1";
    },
    "wrong token": (f: ReturnType<typeof fixture>): void => {
      f.tx.to = recipient;
    },
    "native value": (f: ReturnType<typeof fixture>): void => {
      f.tx.value = "0x1";
    },
    "prequote": (f: ReturnType<typeof fixture>): void => {
      f.quote.quote_block_number = "101";
    },
    "old timestamp": (f: ReturnType<typeof fixture>): void => {
      f.quote.created_at = new Date().toISOString();
    },
    "wrong event contract": (f: ReturnType<typeof fixture>): void => {
      f.receipt.logs[0].address = recipient;
    },
    "removed event": (f: ReturnType<typeof fixture>): void => {
      f.receipt.logs[0].removed = true;
    },
    "receipt mismatch": (f: ReturnType<typeof fixture>): void => {
      f.receipt.transactionHash = `0x${"cc".repeat(32)}`;
    },
    "trailing calldata": (f: ReturnType<typeof fixture>): void => {
      f.tx.input += "00";
    },
  })
) {
  Deno.test(name + " cannot activate", async () => {
    const f = fixture();
    change(f);
    let rejected = false;
    try {
      await verifyTransfer(f.rpc, f.quote, hash);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Accepted invalid transfer");
  });
}
for (const kind of ["missing", "unfinalized", "reorg"] as const) {
  Deno.test(kind + " stays unresolved", async () => {
    const f = fixture();
    if (kind === "missing") {
      f.missing();
    }
    if (kind === "unfinalized") f.finalized("0x64");
    if (kind === "reorg") f.canonical(`0x${"cc".repeat(32)}`);
    if (await verifyTransfer(f.rpc, f.quote, hash) !== null) {
      throw new Error("Premature activation");
    }
  });
}
Deno.test("RPC failure never returns verified evidence", async () => {
  const f = fixture();
  let rejected = false;
  try {
    await verifyTransfer(
      async () => {
        throw new Error("timeout");
      },
      f.quote,
      hash,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Accepted unavailable RPC");
});

Deno.test("finalized reverted transaction returns failure evidence, never success", async () => {
  const f = fixture();
  f.receipt.status = "0x0";
  f.receipt.logs = [];
  const r = await verifyTransfer(f.rpc, f.quote, hash);
  if (r?.success !== false) throw new Error("Reverted accepted");
});
