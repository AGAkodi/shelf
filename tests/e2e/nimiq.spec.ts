import { test, expect } from "@playwright/test";
// Test-only EIP-1193 double; not evidence of a real Nimiq Pay device connection.
test("Nimiq account permission is explicit, rejection recovers, and never authenticates", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      nimiqPay: object;
      ethereum: object;
      walletCalls: string[];
      approve: boolean;
    };
    w.walletCalls = [];
    w.approve = false;
    w.nimiqPay = { language: "en" };
    w.ethereum = {
      request: async ({ method }: { method: string }) => {
        w.walletCalls.push(method);
        if (method === "eth_requestAccounts") {
          if (!w.approve) throw { code: 4001 };
          return ["0x1111111111111111111111111111111111111111"];
        }
        if (method === "eth_accounts")
          return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return "0x89";
        throw new Error("Unexpected wallet request");
      },
    };
  });
  await page.goto("/account");
  await expect(
    page.getByRole("button", { name: "Connect Nimiq Pay" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { walletCalls: string[] }).walletCalls,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
  await expect(page.getByRole("alert")).toContainText("Request declined");
  await page.evaluate(() => {
    (window as unknown as { approve: boolean }).approve = true;
  });
  await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
  await expect(page.getByText("Network: Polygon (137)")).toBeVisible();
  await expect(
    page.getByText(
      "Account permission received. Ownership is verified as a separate step.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { walletCalls: string[] }).walletCalls,
    ),
  ).toEqual([
    "eth_requestAccounts",
    "eth_requestAccounts",
    "eth_chainId",
    "eth_accounts",
    "eth_chainId",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("outside Nimiq Pay browsing remains usable", async ({ page }) => {
  await page.goto("/account");
  await expect(
    page.getByText(
      "Open Shelf from Mini Apps inside Nimiq Pay to connect. You can still browse here.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Nimiq Pay" }),
  ).toHaveCount(0);
});

test("Polygon switch is explicit and wallet changes clear stale account state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const events = new Map<string, (...args: unknown[]) => void>();
    const w = window as unknown as {
      nimiqPay: object;
      ethereum: object;
      walletCalls: string[];
      changeWallet: () => void;
    };
    let chain = "0x1";
    w.walletCalls = [];
    w.nimiqPay = { language: "en" };
    w.changeWallet = () => events.get("accountsChanged")?.([]);
    w.ethereum = {
      on: (event: string, fn: (...args: unknown[]) => void) =>
        events.set(event, fn),
      removeListener: (event: string) => events.delete(event),
      request: async ({
        method,
        params,
      }: {
        method: string;
        params?: unknown[];
      }) => {
        w.walletCalls.push(method);
        if (method === "eth_accounts" || method === "eth_requestAccounts")
          return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return chain;
        if (method === "wallet_switchEthereumChain") {
          if (JSON.stringify(params) !== JSON.stringify([{ chainId: "0x89" }]))
            throw new Error("Wrong network request");
          chain = "0x89";
          events.get("chainChanged")?.(chain);
          return null;
        }
        throw new Error("Unexpected method");
      },
    };
  });
  await page.goto("/account");
  await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
  await expect(
    page.getByText("Network: Chain 1", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { walletCalls: string[] }).walletCalls.includes(
        "wallet_switchEthereumChain",
      ),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Switch to Polygon" }).click();
  await expect(page.getByText("Network: Polygon (137)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to Polygon" }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as { changeWallet: () => void }).changeWallet(),
  );
  await expect(page.getByText("Network: Polygon (137)")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Wallet changed");
});
