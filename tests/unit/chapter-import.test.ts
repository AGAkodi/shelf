import { describe, expect, it } from "vitest";
import {
  buildChapter,
  docxParagraphs,
  docxXmlParagraphs,
  ImportError,
  importKind,
  linesFromItems,
  MAX_PARAGRAPH,
  MAX_PARAGRAPHS,
  normalizeParagraphs,
  paragraphsFromLines,
  zipEntry,
} from "../../src/features/admin/chapterImport";
// @ts-expect-error Test-only JavaScript fixture builder without type declarations.
import { makeDocx, zip } from "../fixtures/documents.mjs";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

describe("DOCX import", () => {
  it("reads deflated and stored archives in paragraph order", async () => {
    for (const store of [false, true]) {
      const bytes = makeDocx([["The first ", "paragraph."], ["Second", "\t", "with a tab."]], { store });
      expect(await docxParagraphs(bytes)).toEqual(["The first paragraph.", "Second with a tab."]);
    }
  });
  it("excludes deleted tracked changes and field codes, and does not duplicate nested paragraphs", () => {
    const xml = `<w:document ${W}><w:body>
      <w:p><w:r><w:t>Kept</w:t></w:r><w:del><w:r><w:delText>gone</w:delText></w:r></w:del><w:r><w:instrText>PAGE</w:instrText></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    </w:body></w:document>`;
    expect(docxXmlParagraphs(xml)).toEqual(["Kept", "Cell"]);
  });
  it("treats markup inside text as plain text", async () => {
    const result = normalizeParagraphs(await docxParagraphs(makeDocx([["<script>alert(1)</script> & more"]])));
    expect(result.paragraphs).toEqual(["‹script›alert(1)‹/script› & more"]);
    expect(result.replacedAngles).toBe(true);
  });
  it("rejects files that are not DOCX archives", async () => {
    await expect(docxParagraphs(new TextEncoder().encode("not a zip"))).rejects.toBeInstanceOf(ImportError);
    await expect(docxParagraphs(zip({ "other.xml": "<x/>" }))).rejects.toBeInstanceOf(ImportError);
    expect(() => docxXmlParagraphs("<w:document")).toThrow(ImportError);
  });
  it("refuses an entry that inflates beyond its declared size", async () => {
    const archive = zip({ "word/document.xml": "a".repeat(100000) });
    // Lie about the uncompressed size in the central directory (offset 24 of the entry header).
    const view = new DataView(archive.buffer);
    const eocd = archive.length - 22;
    const central = view.getUint32(eocd + 16, true);
    view.setUint32(central + 24, 10, true);
    await expect(zipEntry(archive, "word/document.xml")).rejects.toBeInstanceOf(ImportError);
  });
});

describe("PDF text grouping", () => {
  const item = (str: string, y: number, hasEOL = false) => ({ str, transform: [12, 0, 0, 12, 72, y], height: 12, hasEOL });
  it("joins lines into paragraphs using vertical gaps and pages, and rejoins hyphenated words", () => {
    const page1 = linesFromItems([
      item("A first line that", 760), item(" continues here", 760, true),
      item("and wraps to a sec-", 746, true), item("ond line.", 732, true),
      item("A new paragraph.", 702, true),
      { type: "beginMarkedContent" },
    ], 1);
    const page2 = linesFromItems([item("Next page text.", 760, true)], 2);
    expect(paragraphsFromLines([...page1, ...page2])).toEqual([
      "A first line that continues here and wraps to a second line.",
      "A new paragraph.",
      "Next page text.",
    ]);
  });
});

describe("PDF paragraph gaps on short pages", () => {
  it("separates paragraphs when line gaps and paragraph gaps are equally common", () => {
    const line = (text: string, y: number) => ({ text, y, height: 12, page: 1 });
    expect(paragraphsFromLines([line("One a", 760), line("one b.", 746), line("Two.", 716)]))
      .toEqual(["One a one b.", "Two."]);
  });
});

describe("chapter limits", () => {
  it("drops empty paragraphs, collapses whitespace and control characters", () => {
    expect(normalizeParagraphs(["  a\u0007 \n b ", "", "   "]).paragraphs).toEqual(["a b"]);
  });
  it("splits paragraphs over the reader limit at a sentence boundary", () => {
    const sentence = "This is a sentence of moderate length. ";
    const long = sentence.repeat(Math.ceil((MAX_PARAGRAPH * 1.5) / sentence.length));
    const result = normalizeParagraphs([long]);
    expect(result.splitParagraphs).toBe(1);
    expect(result.paragraphs.length).toBe(2);
    expect(result.paragraphs.every((p) => p.length <= MAX_PARAGRAPH)).toBe(true);
    expect(result.paragraphs[0].endsWith(".")).toBe(true);
  });
  it("rejects empty documents and documents with too many paragraphs", () => {
    expect(() => normalizeParagraphs(["", " "])).toThrow(ImportError);
    expect(() => normalizeParagraphs(Array.from({ length: MAX_PARAGRAPHS + 1 }, (_, i) => `p${i}`))).toThrow(/split the document/);
  });
  it("builds a chapter-text-v1 payload that passes the upload validator's rules", () => {
    const chapter = buildChapter(["One", "Two"], 2, "  The   Title ");
    expect(chapter).toEqual({ format: "chapter-text-v1", chapter: 2, title: "The Title", paragraphs: ["One", "Two"] });
    expect(() => buildChapter(["x"], 0, "T")).toThrow(ImportError);
    expect(() => buildChapter(["x"], 1, " ")).toThrow(ImportError);
    expect(() => buildChapter(["x"], 1, "<b>")).toThrow(ImportError);
    expect(() => buildChapter(Array.from({ length: 60 }, () => "x".repeat(19000)), 1, "Big")).toThrow(/1 MiB/);
  });
  it("detects file kinds by extension or type", () => {
    expect(importKind({ name: "Book.DOCX", type: "" })).toBe("docx");
    expect(importKind({ name: "scan", type: "application/pdf" })).toBe("pdf");
    expect(importKind({ name: "c.json", type: "" })).toBe("json");
    expect(importKind({ name: "notes.txt", type: "text/plain" })).toBe("json");
    expect(importKind({ name: "image.png", type: "image/png" })).toBeUndefined();
  });
});
