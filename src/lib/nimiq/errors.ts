export function walletError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? Number(error.code)
      : undefined;
  if (code === 4001)
    return "Request declined. You can try connecting again when ready.";
  if (code === 4100)
    return "Account permission is unavailable. Reopen Shelf in Nimiq Pay and connect again.";
  if (code === 4900 || code === 4901)
    return "The wallet is disconnected. Reopen Shelf in Nimiq Pay.";
  if (code === 4902) return "Polygon is unavailable in this wallet version.";
  return "The wallet could not respond. Check Nimiq Pay and try again.";
}
