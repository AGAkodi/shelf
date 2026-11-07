// Converts an administrator's DOCX or PDF into a plain-text chapter-text-v1 chapter in the browser.
// The result goes through the same upload, storage, delivery and reader path as a JSON chapter, so
// protected reading and its authorization are unchanged. Only text is kept: no HTML, styles, links,
// images or embedded content survive conversion.

export const MAX_PARAGRAPHS = 1000;
export const MAX_PARAGRAPH = 20000;
export const MAX_CHAPTER_BYTES = 1048576;
const MAX_SOURCE_BYTES = 20 * 1048576;
const MAX_XML_BYTES = 40 * 1048576;
const MAX_PDF_PAGES = 500;

export class ImportError extends Error {}

export type Chapter = {
  format: "chapter-text-v1";
  chapter: number;
  title: string;
  paragraphs: string[];
};
export type Conversion = {
  paragraphs: string[];
  replacedAngles: boolean;
  splitParagraphs: number;
};

export function importKind(file: { name: string; type: string }): "json" | "docx" | "pdf" | undefined {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".json") || file.type === "application/json" || file.type === "text/plain") return "json";
  return undefined;
}

/** Trim, collapse whitespace, drop empties, neutralise angle brackets and split oversize paragraphs. */
export function normalizeParagraphs(raw: string[]): Conversion {
  let replacedAngles = false, splitParagraphs = 0;
  const out: string[] = [];
  for (const value of raw) {
    let text = Array.from(value, (c) => {
      const code = c.charCodeAt(0);
      return code < 32 || code === 127 ? " " : c; // control characters become spaces
    }).join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (/[<>]/.test(text)) {
      replacedAngles = true;
      text = text.replace(/</g, "‹").replace(/>/g, "›");
    }
    if (text.length <= MAX_PARAGRAPH) {
      out.push(text);
      continue;
    }
    splitParagraphs++;
    while (text.length > MAX_PARAGRAPH) {
      const window = text.slice(0, MAX_PARAGRAPH);
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      const cut = sentence > MAX_PARAGRAPH / 2 ? sentence + 1 : window.lastIndexOf(" ") > 0 ? window.lastIndexOf(" ") : MAX_PARAGRAPH;
      out.push(text.slice(0, cut).trim());
      text = text.slice(cut).trim();
    }
    if (text) out.push(text);
  }
  if (!out.length) throw new ImportError("No readable text was found in this file.");
  if (out.length > MAX_PARAGRAPHS) {
    throw new ImportError(`This file has ${out.length} paragraphs. A chapter can hold ${MAX_PARAGRAPHS}; split the document into smaller chapters.`);
  }
  return { paragraphs: out, replacedAngles, splitParagraphs };
}

export function buildChapter(paragraphs: string[], chapter: number, title: string): Chapter {
  const name = title.replace(/\s+/g, " ").trim();
  if (!Number.isSafeInteger(chapter) || chapter < 1) throw new ImportError("Enter a positive chapter number.");
  if (!name) throw new ImportError("Enter a chapter title.");
  if (/[<>]/.test(name)) throw new ImportError("Remove < and > from the chapter title.");
  const result: Chapter = { format: "chapter-text-v1", chapter, title: name, paragraphs };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_CHAPTER_BYTES) {
    throw new ImportError("This chapter is larger than 1 MiB of text. Split the document into smaller chapters.");
  }
  return result;
}

// ---------- DOCX ----------

async function inflateRaw(data: Uint8Array, expected: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new ImportError("This browser cannot open DOCX files. Use a current Chrome, Edge, Safari or Firefox.");
  }
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(data)); // copy onto a plain ArrayBuffer
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    let step;
    try {
      step = await reader.read();
    } catch {
      throw new ImportError("This DOCX file is damaged and could not be read.");
    }
    const { value, done } = step;
    if (done) break;
    size += value.length;
    if (size > MAX_XML_BYTES || size > expected + 1024) {
      await reader.cancel();
      throw new ImportError("This DOCX file could not be read safely.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Reads one stored entry from a ZIP archive using its central directory. */
export async function zipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array> {
  const bad = () => new ImportError("This is not a valid DOCX file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw bad();
  const entries = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < entries; n++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw bad();
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (name === wanted) {
      if (size > MAX_XML_BYTES) throw new ImportError("This DOCX file is too large to import.");
      if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw bad();
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      if (start + compressed > bytes.length) throw bad();
      const data = bytes.subarray(start, start + compressed);
      if (method === 0) return data.slice();
      if (method === 8) return inflateRaw(data, size);
      throw new ImportError("This DOCX file uses an unsupported compression method.");
    }
    p += 46 + nameLength + extra + comment;
  }
  throw bad();
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Paragraph text from word/document.xml. Deleted tracked changes and field codes are excluded. */
export function docxXmlParagraphs(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new ImportError("This DOCX file could not be read.");
  const out: string[] = [];
  const paragraphs = doc.getElementsByTagNameNS(W, "p");
  for (let i = 0; i < paragraphs.length; i++) {
    let text = "";
    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        if (child.namespaceURI === W && child.localName === "p") continue; // nested paragraphs are visited on their own
        if (child.namespaceURI === W && (child.localName === "del" || child.localName === "instrText")) continue;
        if (child.namespaceURI === W && child.localName === "t") text += child.textContent ?? "";
        else if (child.namespaceURI === W && ["tab", "br", "cr"].includes(child.localName)) text += " ";
        else walk(child);
      }
    };
    walk(paragraphs[i]);
    out.push(text);
  }
  return out;
}

export async function docxParagraphs(bytes: Uint8Array): Promise<string[]> {
  if (bytes.length > MAX_SOURCE_BYTES) throw new ImportError("This file is larger than 20 MiB.");
  const xml = new TextDecoder().decode(await zipEntry(bytes, "word/document.xml"));
  return docxXmlParagraphs(xml);
}

// ---------- PDF ----------

export type PdfLine = { text: string; y: number; height: number; page: number };
type PdfItem = { str: string; transform: number[]; height: number; hasEOL: boolean };

/** Joins pdf.js text items into visual lines. */
export function linesFromItems(items: unknown[], page: number): PdfLine[] {
  const lines: PdfLine[] = [];
  let text = "", y = NaN, height = 0;
  const flush = () => {
    if (text.trim()) lines.push({ text: text.trim(), y, height: height || 10, page });
    text = "";
    y = NaN;
    height = 0;
  };
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue; // marked-content markers
    const item = raw as PdfItem;
    const itemY = item.transform?.[5] ?? NaN;
    if (text && Number.isFinite(y) && Number.isFinite(itemY) && Math.abs(itemY - y) > Math.max(item.height, height, 1) * 0.5) flush();
    if (!text) y = itemY;
    text += item.str;
    height = Math.max(height, item.height || 0);
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

/** Groups lines into paragraphs: a larger-than-usual vertical gap or a new page starts one. */
export function paragraphsFromLines(lines: PdfLine[]): string[] {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].page === lines[i - 1].page) {
      const gap = lines[i - 1].y - lines[i].y;
      if (gap > 0) gaps.push(gap);
    }
  }
  gaps.sort((a, b) => a - b);
  // Line spacing is the common small gap; the lower quartile stays on it even when a short page
  // has as many paragraph gaps as line gaps (where a median would pick the paragraph gap).
  const usual = gaps.length ? gaps[Math.floor((gaps.length - 1) / 4)] : 0;
  const out: string[] = [];
  let current = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], prev = lines[i - 1];
    const gap = prev && prev.page === line.page ? prev.y - line.y : Infinity;
    const breakHere = !prev || line.page !== prev.page || (usual > 0 && gap > usual * 1.5) || gap < 0;
    if (breakHere && current) {
      out.push(current);
      current = "";
    }
    if (current.endsWith("-") && /^[a-z]/.test(line.text)) current = current.slice(0, -1) + line.text;
    else current = current ? current + " " + line.text : line.text;
  }
  if (current) out.push(current);
  return out;
}

export async function pdfParagraphs(bytes: Uint8Array): Promise<string[]> {
  if (bytes.length > MAX_SOURCE_BYTES) throw new ImportError("This file is larger than 20 MiB.");
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, enableXfa: false, useSystemFonts: false });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    void task.destroy();
    throw new ImportError("This PDF could not be opened. It may be damaged or password-protected.");
  }
  try {
    if (doc.numPages > MAX_PDF_PAGES) throw new ImportError(`This PDF has more than ${MAX_PDF_PAGES} pages. Split it into smaller chapters.`);
    const lines: PdfLine[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      lines.push(...linesFromItems((await page.getTextContent()).items, n));
      page.cleanup();
    }
    if (!lines.length) throw new ImportError("This PDF has no selectable text. Scanned pages are not supported.");
    return paragraphsFromLines(lines);
  } finally {
    void task.destroy();
  }
}

export async function convertFile(file: File): Promise<Conversion> {
  const kind = importKind(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "docx") return normalizeParagraphs(await docxParagraphs(bytes));
  if (kind === "pdf") return normalizeParagraphs(await pdfParagraphs(bytes));
  throw new ImportError("Choose a DOCX or PDF file to convert.");
}
