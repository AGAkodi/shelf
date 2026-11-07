import { type FormEvent, useRef, useState } from "react";
import { type Client, upload } from "./data";
import type { Run } from "./CatalogueEditor";
import { buildChapter, type Conversion, convertFile, ImportError, importKind } from "./chapterImport";

const ACCEPT = [
  ".json", ".docx", ".pdf",
  "application/json", "text/plain", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

/** Private chapter upload: chapter-text-v1 JSON as-is, or DOCX/PDF converted to plain text first. */
export function ChapterUpload(
  { db, book, version, nextChapter, run }: {
    db: Client;
    book: string;
    version: number;
    nextChapter: number;
    run: Run;
  },
) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [converted, setConverted] = useState<Conversion>();
  const [converting, setConverting] = useState(false);
  const [problem, setProblem] = useState("");
  const [chapter, setChapter] = useState(String(nextChapter));
  const [title, setTitle] = useState("");
  const kind = file ? importKind(file) : undefined;

  async function choose(next: File | undefined) {
    setFile(next);
    setConverted(undefined);
    setProblem("");
    if (!next) return;
    const k = importKind(next);
    if (!k) {
      setProblem("Choose a DOCX, PDF or chapter-text-v1 JSON file.");
      return;
    }
    if (k === "json") return;
    setTitle(next.name.replace(/\.(docx|pdf)$/i, "").replace(/[_-]+/g, " ").trim());
    setConverting(true);
    try {
      setConverted(await convertFile(next));
    } catch (e) {
      setProblem(e instanceof ImportError ? e.message : "This file could not be converted.");
    } finally {
      setConverting(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    run(async () => {
      let payload = file;
      if (kind === "docx" || kind === "pdf") {
        if (!converted) throw new Error(problem || "Wait for the conversion to finish.");
        const result = buildChapter(converted.paragraphs, Number(chapter), title);
        payload = new File([JSON.stringify(result)], `chapter-${result.chapter}.json`, { type: "application/json" });
      }
      await upload(db, book, payload, "chapter", version);
      setFile(undefined);
      setConverted(undefined);
      if (input.current) input.current.value = "";
    });
  }

  const ready = kind === "json" || (!!converted && !converting);
  return (
    <form onSubmit={submit}>
      <label>
        Private chapter (DOCX, PDF or chapter-text-v1 JSON)
        <input
          ref={input}
          name="file"
          type="file"
          accept={ACCEPT}
          required
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      {(kind === "docx" || kind === "pdf") && (
        <>
          <p className="fine-print">
            Only the text is kept. Formatting, images, tables layout and links are removed.
            {kind === "pdf" && " Scanned PDFs without selectable text cannot be converted."}
          </p>
          <label>
            Chapter number
            <input
              type="number"
              min={1}
              step={1}
              required
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
            />
          </label>
          <label>
            Chapter title
            <input required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </>
      )}
      {converting && <p role="status">Converting {kind?.toUpperCase()}…</p>}
      {problem && <p role="alert" className="notice">{problem}</p>}
      {converted && (
        <div role="status" className="chapter-preview">
          <p>
            Ready: {converted.paragraphs.length} paragraph{converted.paragraphs.length === 1 ? "" : "s"}.
            {converted.splitParagraphs > 0 && ` ${converted.splitParagraphs} very long paragraph(s) were split.`}
            {converted.replacedAngles && " Angle brackets were replaced with ‹ ›."}
          </p>
          <blockquote>{converted.paragraphs[0].slice(0, 280)}{converted.paragraphs[0].length > 280 ? "…" : ""}</blockquote>
        </div>
      )}
      <button className="button-secondary" disabled={!ready}>Upload chapter</button>
    </form>
  );
}
