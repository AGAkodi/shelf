/* global document, innerWidth -- Playwright page evaluation callbacks */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { localClients } from "../../scripts/lib/local-supabase.mjs";

test("admin manages a real catalogue entry on a mobile viewport", async () => {
  const { server, reader, url, anonKey } = localClients();
  const must = (r) => {
    assert.equal(r.error, null, r.error?.message);
    return r.data;
  };
  const email = "admin-ui-" + randomUUID() + "@example.invalid",
    password = randomUUID();
  const user = must(
    await server.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    }),
  ).user;
  const session =
    must(await reader().auth.signInWithPassword({ email, password })).session;
  const title = "Admin test " + randomUUID();
  let vite, browser;
  try {
    process.env.VITE_SUPABASE_URL = url;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
    vite = await createServer({
      server: { host: "127.0.0.1", port: 5187, strictPort: true },
    });
    await vite.listen();
    browser = await chromium.launch({ channel: "chrome" });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.addInitScript(
      (s) => localStorage.setItem("sb-127-auth-token", JSON.stringify(s)),
      session,
    );
    await page.goto("http://127.0.0.1:5187/admin");
    await page.getByRole("heading", { name: "Administrator access required" })
      .waitFor();
    must(
      await server.from("user_roles").insert({
        user_id: user.id,
        role: "admin",
      }),
    );
    await page.reload();
    const button = (name) => page.getByRole("button", { name, exact: true });
    const saved = async (name) => {
      await button(name).click();
      await page.waitForFunction(() =>
        document.querySelector(".admin-dashboard [role=status]")
            ?.textContent === "Saved." ||
        document.querySelector(".admin-dashboard [role=alert]")
      );
      assert.equal(
        await page.locator(".admin-dashboard [role=alert]").count(),
        0,
        await page.locator(".admin-dashboard").innerText(),
      );
    };
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Author", { exact: true }).fill("Test author");
    await page.getByLabel("Category", { exact: true }).fill("Fiction");
    await saved("Create draft");
    await page.getByLabel("Description", { exact: true }).fill(
      "Updated description",
    );
    await saved("Save book");
    await page.getByLabel("3-day fee in USDT", { exact: true }).fill(
      "1.250001",
    );
    await page.getByLabel("Enabled", { exact: true }).first().check();
    await saved("Save 3-day plan");
    await page.getByLabel(/Private chapter/).setInputFiles({
      name: "chapter.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "chapter-text-v1",
          chapter: 1,
          title: "Beginning",
          paragraphs: ["Test chapter."],
        }),
      ),
    });
    await saved("Upload chapter");
    await page.getByLabel(/Cover image/).setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhK0AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await saved("Upload cover");
    await page.getByLabel("Rights holder").fill("Test author");
    await page.getByLabel("Evidence of distribution permission").fill(
      "Local test fixture",
    );
    await saved("Record distribution permission");
    await saved("Publish book");
    const book = must(
      await reader().from("books").select("id,description,cover_path").eq(
        "title",
        title,
      ).single(),
    );
    assert.equal(book.description, "Updated description");
    assert.ok(book.cover_path);
    await saved("Unpublish book");
    assert.equal(
      must(await reader().from("books").select("id").eq("id", book.id)).length,
      0,
    );
    for (const tab of ["Loans", "Payments & revenue", "Applications"]) {
      await button(tab).click();
    }
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
      ),
    );
  } finally {
    await browser?.close();
    await vite?.close();
    const book = must(
      await server.from("books").select("id,cover_path").eq("title", title)
        .maybeSingle(),
    );
    if (book) {
      const assets = must(
        await server.from("book_assets").select("object_path").eq(
          "book_id",
          book.id,
        ),
      );
      if (assets.length) {
        must(
          await server.storage.from("protected-books").remove(
            assets.map((a) => a.object_path),
          ),
        );
      }
      if (book.cover_path) {
        must(await server.storage.from("covers").remove([book.cover_path]));
      }
      for (const t of ["book_assets", "book_licenses", "borrowing_plans"]) {
        must(await server.from(t).delete().eq("book_id", book.id));
      }
      must(await server.from("books").delete().eq("id", book.id));
    }
    must(await server.auth.admin.deleteUser(user.id));
  }
});
