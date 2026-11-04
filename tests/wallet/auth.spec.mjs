import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { localClients } from "../../scripts/lib/local-supabase.mjs";
import { localOtp } from "../../scripts/lib/local-otp.mjs";
test("email code, rejected signature, verified wallet, refresh, account change and sign-out", async ({
  page,
}, info) => {
  const { server } = localClients(),
    email = `browser-${randomUUID()}@example.invalid`;
  const { data, error } = await server.auth.admin.createUser({
    email,
    email_confirm: false,
  });
  expect(error).toBeNull();
  const wallet = privateKeyToAccount(generatePrivateKey());
  let allow = false;
  try {
    await page.exposeFunction("shelfTestSign", async (typed) => {
      if (!allow) throw new Error("declined");
      return wallet.signTypedData(typed);
    });
    await page.addInitScript(
      ({ address }) => {
        const events = new Map();
        let account = address;
        window.nimiqPay = { language: "en" };
        window.shelfTestChange = () => {
          account = "0x2222222222222222222222222222222222222222";
          events.get("accountsChanged")?.([account]);
        };
        window.ethereum = {
          on: (name, fn) => events.set(name, fn),
          removeListener: (name) => events.delete(name),
          request: async ({ method, params }) => {
            if (method === "eth_accounts" || method === "eth_requestAccounts")
              return [account];
            if (method === "eth_chainId") return "0x89";
            if (method === "eth_signTypedData_v4") {
              try {
                return await window.shelfTestSign(JSON.parse(params[1]));
              } catch {
                throw { code: 4001 };
              }
            }
            throw new Error("Unexpected wallet operation");
          },
        };
      },
      { address: wallet.address },
    );
    await page.goto("/");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send sign-in code" }).click();
    await expect(
      page.getByLabel("Sign-in code", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Sign-in code", { exact: true })
      .fill(await localOtp(email));
    await page.getByRole("button", { name: "Verify email code" }).click();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
    await page
      .getByRole("button", { name: "Verify wallet ownership", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Request declined" }),
    ).toBeVisible();
    allow = true;
    await page
      .getByRole("button", { name: "Verify wallet ownership", exact: true })
      .click();
    await expect(
      page.getByText("Wallet ownership verified for this Shelf session."),
    ).toBeVisible();
    await page.screenshot({
      path: `supabase/.temp/wallet-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
    await expect(
      page.getByText("Wallet ownership verified for this Shelf session."),
    ).toBeVisible();
    await page.evaluate(() => window.shelfTestChange());
    await expect(
      page.getByText("Wallet ownership verified for this Shelf session."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
    await expect(
      page.getByText(
        "This Shelf account is linked to a different wallet. Switch to your previously verified wallet.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByLabel("Email address", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Wallet ownership verified for this Shelf session."),
    ).toHaveCount(0);
  } finally {
    const result = await server.auth.admin.deleteUser(data.user.id);
    expect(result.error).toBeNull();
  }
});
