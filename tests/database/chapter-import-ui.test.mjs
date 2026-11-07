/* global document, innerWidth -- Playwright page evaluation callbacks */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { localClients } from "../../scripts/lib/local-supabase.mjs";
import { makeDocx, makePdf } from "../fixtures/documents.mjs";

test("admin imports DOCX and PDF chapters into private storage as plain text", async () => {
  const { server, reader, url, anonKey } = localClients();
  const must = (r) => {
    assert.equal(r.error, null, r.error?.message);
    return r.data;
  };
  const email = "import-ui-" + randomUUID() + "@example.invalid", password = randomUUID();
  const user = must(await server.auth.admin.createUser({ email, password, email_confirm: true })).user;
  must(await server.from("user_roles").insert({ user_id: user.id, role: "admin" }));
  const session = must(await reader().auth.signInWithPassword({ email, password })).session;
  const title = "Import test " + randomUUID();
  const book = must(await server.from("books").insert({
    title, author: "Test author", category: "Fiction", description: "Import fixture", ownership: "platform",
  }).select("id").single());
  let vite, browser;
  try {
    process.env.VITE_SUPABASE_URL = url;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
    vite = await createServer({ server: { host: "127.0.0.1", port: 5188, strictPort: true } });
    await vite.listen();
    browser = await chromium.launch({ channel: "chrome" });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript((s) => localStorage.setItem("sb-127-auth-token", JSON.stringify(s)), session);
    await page.goto("http://127.0.0.1:5188/admin");
    await page.getByLabel("Catalogue book").selectOption({ label: `${title} · draft` });
    const chapterInput = page.getByLabel(/Private chapter/);
    const upload = page.getByRole("button", { name: "Upload chapter", exact: true });
    const saved = async () => {
      await upload.click();
      await page.waitForFunction(() =>
        document.querySelector(".admin-dashboard [role=status]")?.textContent === "Saved." ||
        document.querySelector(".admin-dashboard > [role=alert], .admin-dashboard section > [role=alert]"));
      assert.equal(await page.getByText("Saved.", { exact: true }).count(), 1, await page.locator(".admin-dashboard").innerText());
    };

    // DOCX: markup in text stays text; tabs become spaces; empty paragraphs disappear.
    await chapterInput.setInputFiles({
      name: "opening_chapter.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(makeDocx([["It began ", "quietly."], [""], ["A <b>bold</b>", "\t", "claim."]])),
    });
    await page.getByText("Ready: 2 paragraphs.", { exact: false }).waitFor();
    assert.equal(await page.getByLabel("Chapter title").inputValue(), "opening chapter");
    assert.equal(await page.getByLabel("Chapter number").inputValue(), "1");
    await page.getByLabel("Chapter title").fill("Opening");
    await saved();

    // PDF: two pages, wrapped lines rejoined, paragraph gaps respected.
    await chapterInput.setInputFiles({
      name: "second.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(makePdf([
        [["The second chapter opens", "on a wrapped line."], ["Then a new paragraph."]],
        [["Page two (with parentheses)."]],
      ])),
    });
    await page.getByText("Ready: 3 paragraphs.", { exact: false }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByLabel("Chapter number").inputValue(), "2");
    await page.getByLabel("Chapter title").fill("Second");
    await saved();

    // Unusable files are refused before upload with a clear message.
    await chapterInput.setInputFiles({ name: "blank.pdf", mimeType: "application/pdf", buffer: Buffer.from(makePdf([[]])) });
    await page.getByText("This PDF has no selectable text", { exact: false }).waitFor({ timeout: 30000 });
    assert.equal(await upload.isDisabled(), true);
    await chapterInput.setInputFiles({ name: "broken.docx", mimeType: "application/octet-stream", buffer: Buffer.from("not a zip") });
    await page.getByText("This is not a valid DOCX file.").waitFor();
    assert.equal(await upload.isDisabled(), true);

    const assets = must(await server.from("book_assets").select("chapter_number,object_path,byte_size,sha256")
      .eq("book_id", book.id).order("chapter_number"));
    assert.deepEqual(assets.map((a) => a.chapter_number), [1, 2]);
    const stored = [];
    for (const a of assets) {
      const blob = must(await server.storage.from("protected-books").download(a.object_path));
      const bytes = Buffer.from(await blob.arrayBuffer());
      assert.equal(bytes.length, a.byte_size);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), a.sha256);
      stored.push(JSON.parse(bytes.toString("utf8")));
    }
    assert.deepEqual(stored[0], {
      format: "chapter-text-v1", chapter: 1, title: "Opening",
      paragraphs: ["It began quietly.", "A ‹b›bold‹/b› claim."],
    });
    assert.deepEqual(stored[1], {
      format: "chapter-text-v1", chapter: 2, title: "Second",
      paragraphs: ["The second chapter opens on a wrapped line.", "Then a new paragraph.", "Page two (with parentheses)."],
    });
    // Same constraints the protected delivery handler enforces before serving a chapter.
    for (const c of stored) assert.ok(c.paragraphs.every((p) => p.length <= 20000 && !/[<>]/.test(p)));
    // Readers still cannot reach the private objects.
    const readerClient = reader();
    assert.ok((await readerClient.storage.from("protected-books").download(assets[0].object_path)).error);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  } finally {
    await browser?.close();
    await vite?.close();
    const assets = must(await server.from("book_assets").select("object_path").eq("book_id", book.id));
    if (assets.length) must(await server.storage.from("protected-books").remove(assets.map((a) => a.object_path)));
    must(await server.from("book_assets").delete().eq("book_id", book.id));
    must(await server.from("books").delete().eq("id", book.id));
    must(await server.auth.admin.deleteUser(user.id));
  }
});
