import {
  archiveFetch,
  archiveUrl,
  chaptersFromText,
  cleanText,
  textFiles,
} from "./source.ts";
function assert(value: unknown) {
  if (!value) throw new Error("Assertion failed");
}
Deno.test("only accessible text files within the size limit qualify", () => {
  const metadata = { mediatype: "texts" };
  assert(
    textFiles({ metadata, files: [{ name: "book_djvu.txt", size: "100" }] })
      .length === 1,
  );
  assert(
    textFiles({
      metadata,
      files: [{ name: "book.txt", format: "Text", size: "100" }],
    }).length === 1,
  );
  for (
    const file of [{ name: "book.pdf", format: "Text" }, {
      name: "book_djvu.txt",
      private: "true",
    }, { name: "book_djvu.txt", size: "5000000" }]
  ) {
    assert(textFiles({ metadata, files: [file] }).length === 0);
  }
  assert(
    textFiles({
      metadata: { ...metadata, access_restricted: "true" },
      files: [{ name: "book_djvu.txt" }],
    }).length === 0,
  );
  assert(
    textFiles({ metadata, is_dark: true, files: [{ name: "book_djvu.txt" }] })
      .length === 0,
  );
});
Deno.test("Archive source URL validation rejects external and credentialed hosts", () => {
  for (
    const url of [
      "http://archive.org/a",
      "https://archive.org.evil.com/a",
      "https://127.0.0.1/a",
      "https://user@archive.org/a",
      "https://archive.org:444/a",
    ]
  ) {
    let denied = false;
    try {
      archiveUrl(url);
    } catch {
      denied = true;
    }
    assert(denied);
  }
  assert(
    archiveUrl("https://ia800001.us.archive.org/file").hostname ===
      "ia800001.us.archive.org",
  );
});
Deno.test("text conversion produces bounded plain-text reading sections", () => {
  const chapters = chaptersFromText(("hello <tag> world\n\n").repeat(10000));
  assert(chapters.length > 1);
  for (const c of chapters) {
    assert(c.paragraphs.every((p) => p.length <= 8000 && !/[<>]/.test(p)));
    assert(JSON.stringify(c).length < 1048576);
  }
  assert(cleanText(["<script>x</script>", "author"], 100) === "x ; author");
});
Deno.test("redirects to an arbitrary external server never get fetched", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls++;
    return Promise.resolve(
      new Response(null, {
        status: 302,
        headers: { location: "https://attacker.invalid/" },
      }),
    );
  }) as typeof fetch;
  try {
    let rejected = false;
    try {
      await archiveFetch("https://archive.org/test");
    } catch {
      rejected = true;
    }
    assert(rejected);
    assert(calls === 1);
  } finally {
    globalThis.fetch = original;
  }
});
