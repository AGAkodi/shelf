import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const routes = ["/", "/explore", "/books/20000000-0000-4000-8000-000000000001", "/checkout/x", "/library",
  "/read/00000000-0000-4000-8000-000000000000", "/transactions", "/admin", "/contribute", "/no-such-page"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
});

test("every route serves the production security headers with no CSP violations", async ({ page }) => {
  for (const path of routes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const h = response!.headers();
    expect(h["content-security-policy"]).toContain("script-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["cache-control"]).toBe("no-cache");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "DM Sans"')), path).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations), path).toEqual([]);
  }
});

test("hashed assets are immutable and the PDF worker may start under worker-src", async ({ page, request }) => {
  const worker = readdirSync("dist/assets").find((f) => /^pdf\.worker\.min-.*\.mjs$/.test(f));
  expect(worker).toBeTruthy();
  const asset = await request.get(`/assets/${worker}`);
  expect(asset.status()).toBe(200);
  expect(asset.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  await page.goto("/");
  const started = await page.evaluate(async (url) => new Promise<string>((resolve) => {
    try {
      const w = new Worker(url, { type: "module" });
      w.onerror = () => resolve("error");
      setTimeout(() => { w.terminate(); resolve("ok"); }, 1500);
    } catch (e) {
      resolve("threw " + String(e));
    }
  }), `/assets/${worker}`);
  expect(started).toBe("ok");
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
});

test("a natively injected provider can still reach an HTTPS RPC, while plain HTTP is blocked", async ({ page }) => {
  await page.goto("/");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("http://example.com/rpc", { method: "POST" });
      return "allowed";
    } catch {
      return "blocked";
    }
  });
  expect(blocked).toBe("blocked");
  const violations = await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
  expect(violations.some((v) => v.startsWith("connect-src"))).toBe(true);
  // An HTTPS request is permitted by policy (the network result itself does not matter here).
  const before = violations.length;
  await page.evaluate(() => fetch("https://example.com/rpc", { method: "POST" }).catch(() => null));
  expect((await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).length).toBe(before);
});
