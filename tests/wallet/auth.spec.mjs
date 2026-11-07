import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { localClients } from "../../scripts/lib/local-supabase.mjs";
import { localOtp } from "../../scripts/lib/local-otp.mjs";
test(
  "email code, rejected signature, verified wallet, refresh, account change and sign-out",
  async ({
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
              if (
                method === "eth_accounts" || method === "eth_requestAccounts"
              ) {
                return [account];
              }
              if (method === "eth_chainId") return "0x89";
              // Test-only read-only answers for the checkout balance/gas preflight.
              if (method === "eth_call") return "0x" + "0".repeat(56) + "05f5e100"; // 100 USDT
              if (method === "eth_getBalance") return "0xde0b6b3a7640000"; // 1 POL
              if (method === "eth_gasPrice") return "0x6fc23ac00"; // 30 gwei
              if (method === "eth_estimateGas") return "0xea60";
              if (method === "eth_signTypedData_v4") {
                try {
                  return await window.shelfTestSign(JSON.parse(params[1]));
                } catch {
                  throw { code: 4001 };
                }
              }
              if (method === "eth_sendTransaction") {
                window.shelfSends = (window.shelfSends || 0) + 1;
                if (window.shelfSends === 1) throw { code: 4001 };
                return "0x" + "ab".repeat(32);
              }
              throw new Error("Unexpected wallet operation");
            },
          };
        },
        { address: wallet.address },
      );
      await page.goto("/account");
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
      // UI-only payment endpoint fixture. Real RPC verification and SQL activation have separate adversarial suites.
      const bookId = "20000000-0000-4000-8000-000000000001";
      const plans = await server.from("borrowing_plans").select("id").eq(
        "book_id",
        bookId,
      ).eq("enabled", true);
      const paymentId = randomUUID();
      const checkout = {
        payment: {
          id: paymentId,
          status: "pending",
          expected_sender: wallet.address.toLowerCase(),
          recipient: "0x46a32bbb4cf751dfeea222e1ced2813f229d1fd5",
          token_contract: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
          chain_id: 137,
          gross_amount: "2000000",
          tx_hash: null,
        },
        loan: { id: randomUUID(), status: "pending_payment", book_id: bookId, borrowing_plan_id: plans.data[0].id, expires_at: null },
        prompted: false,
        candidate_hash: null,
      };
      let verificationCount = 0;
      await page.route("**/functions/v1/payments", async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === "claim") checkout.prompted = true;
        if (body.action === "rejected") checkout.prompted = false;
        if (body.action === "verify") {
          checkout.candidate_hash = "0x" + "ab".repeat(32);
          if (++verificationCount >= 2) {
            checkout.payment.status = "confirmed";
            checkout.loan.status = "active";
          }
        }
        await route.fulfill({ json: checkout });
      });
      await page.goto(`/checkout/${bookId}?plan=${plans.data[0].id}`);
      await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
      await page.getByRole("button", { name: "Prepare checkout" }).click();
      await page.getByRole("button", { name: "Pay USDT", exact: true }).click();
      await expect(
        page.getByText("Payment rejected in wallet. No loan was activated."),
      ).toBeVisible();
      await page.getByRole("button", { name: "Pay USDT", exact: true }).click();
      await expect(page.getByRole("button", { name: "Check payment" }))
        .toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Payment verified", exact: true }),
      ).toHaveCount(0);
      await page.reload();
      await page.getByRole("button", { name: "Check payment" }).click();
      await expect(
        page.getByRole("heading", { name: "Payment verified", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `supabase/.temp/payment-${info.project.name}.png`,
        fullPage: true,
      });
      await page.goto("/account");
      await page.getByRole("button", { name: "Connect Nimiq Pay" }).click();
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
  },
);
