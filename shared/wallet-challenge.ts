export interface WalletChallenge {
  id: string;
  user_id: string;
  session_id: string;
  address: string;
  origin: string;
  nonce: string;
  chain_id: number;
  created_at: string;
  expires_at: string;
}
export function walletTypedData(c: WalletChallenge) {
  return {
    domain: { name: "Shelf", version: "1", chainId: 137 },
    primaryType: "VerifyWallet" as const,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      VerifyWallet: [
        { name: "purpose", type: "string" },
        { name: "origin", type: "string" },
        { name: "userId", type: "string" },
        { name: "sessionId", type: "string" },
        { name: "account", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
      ],
    },
    message: {
      purpose:
        "Verify wallet ownership for Shelf. No transaction or spending approval.",
      origin: c.origin,
      userId: c.user_id,
      sessionId: c.session_id,
      account: c.address as `0x${string}`,
      nonce: c.nonce as `0x${string}`,
      issuedAt: Math.floor(Date.parse(c.created_at) / 1000),
      expiresAt: Math.floor(Date.parse(c.expires_at) / 1000),
    },
  } as const;
}
