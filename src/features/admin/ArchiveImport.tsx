import { type FormEvent, useState } from "react";
import { checked, type Client, upload } from "./data";
import type { Run } from "./CatalogueEditor";

type Item = {
  identifier: string;
  title: string;
  author: string;
  license: string;
};
type Import = Item & {
  description: string;
  category: string;
  cover_alt: string;
  cover: string | null;
  public_preview: string;
  rights_holder: string;
  chapters: {
    format: string;
    chapter: number;
    title: string;
    paragraphs: string[];
  }[];
};
export function ArchiveImport({ db, run }: { db: Client; run: Run }) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<Item[]>(),
    [searching, setSearching] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  async function request<T>(body: Record<string, unknown>): Promise<T> {
    const result = await db.functions.invoke("archive", { body });
    if (result.error || result.data?.error) {
      const response = result.error?.context;
      const detail = response instanceof Response
        ? await response.clone().json().catch(() => null)
        : result.data;
      throw new Error(
        detail?.error ?? "Internet Archive could not be reached. Try again.",
      );
    }
    return result.data;
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError("");
    try {
      setItems(
        (await request<{ items: Item[] }>({ action: "search", query })).items,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }
  async function importBook(identifier: string) {
    setProgress("Fetching source text…");
    try {
      const source = await request<Import>({ action: "import", identifier });
      const existing = await db.from("books").select("id,status").eq(
        "archive_identifier",
        identifier,
      ).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.status === "published") {
        throw new Error(
          "This source is already published. Edit it in Catalogue.",
        );
      }
      let book = existing.data;
      if (!book) {
        const created = await db.from("books").insert({
          title: source.title,
          author: source.author,
          description: source.description,
          archive_identifier: identifier,
          source_license: source.license,
          category: source.category,
          cover_alt: source.cover_alt,
          public_preview: source.public_preview,
          lending_copies: 10,
        }).select("id,status").single();
        if (created.error?.code === "23505") {
          throw new Error(
            "Another import created this source. Refresh and resume it.",
          );
        }
        book = checked(created);
      } else {
        const current = checked<
          {
            category: string;
            cover_alt: string;
            public_preview: string;
            source_license: string | null;
            lending_copies: number;
          }
        >(
          await db.from("books").select(
            "category,cover_alt,public_preview,source_license,lending_copies",
          ).eq("id", book.id).single(),
        );
        checked(
          await db.from("books").update({
            category: current.category === "Uncategorized"
              ? source.category
              : current.category,
            cover_alt: current.cover_alt || source.cover_alt,
            public_preview: current.public_preview || source.public_preview,
            source_license: current.source_license || source.license,
            lending_copies: current.lending_copies === 1
              ? 10
              : current.lending_copies,
          }).eq("id", book.id).select("id").single(),
        );
      }
      const license = await db.from("book_licenses").select(
        "id,distribution_permitted",
      ).eq(
        "book_id",
        book.id,
      ).limit(1).maybeSingle();
      if (license.error) throw license.error;
      if (!license.data) {
        checked(
          await db.from("book_licenses").insert({
            book_id: book.id,
            rights_holder: source.rights_holder,
            rights_evidence: [
              `Internet Archive: https://archive.org/details/${identifier}`,
              source.license || "No rights statement supplied",
            ].join("\n"),
            distribution_permitted: false,
          }).select("id").single(),
        );
      } else if (!license.data.distribution_permitted) {
        checked(
          await db.from("book_licenses").update({
            rights_holder: source.rights_holder,
          })
            .eq("id", license.data.id).eq("distribution_permitted", false)
            .select("id").single(),
        );
      }
      if (source.cover) {
        const binary = atob(source.cover);
        const bytes = Uint8Array.from(
          binary,
          (character) => character.charCodeAt(0),
        );
        await upload(
          db,
          book.id,
          new File([bytes], "cover.jpg", { type: "image/jpeg" }),
          "cover",
          1,
        );
      }
      for (const chapter of source.chapters) {
        setProgress(
          `Importing section ${chapter.chapter} of ${source.chapters.length}…`,
        );
        const file = new File([JSON.stringify(chapter)], "chapter.json", {
          type: "application/json",
        });
        await upload(db, book.id, file, "chapter", 1);
      }
      setProgress(
        `Imported “${source.title}” as a draft with 10 lending copies. Review the rights and set borrowing prices before publishing.`,
      );
    } catch (e) {
      setProgress("");
      throw e;
    }
  }
  return (
    <section className="admin-editor">
      <h2>Internet Archive</h2>
      <p className="description">
        Search for books with downloadable text. Shelf checks each result, so
        searching may take a moment. Review rights and text before publishing.
      </p>
      <form onSubmit={search}>
        <label>
          Book title or author<input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            maxLength={160}
            required
          />
        </label>
        <button className="button-primary" disabled={searching}>
          {searching ? "Searching…" : "Search Internet Archive"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p role="status">{progress}</p>
      {items?.length === 0 && (
        <p>
          No downloadable text found among these results. Try a more specific
          title or author.
        </p>
      )}
      {items?.map((item) => (
        <article key={item.identifier}>
          <h3>{item.title}</h3>
          <p>{item.author}</p>
          <p className="fine-print">
            {item.license || "Review source rights before publication"}
          </p>
          <a
            className="back-link"
            href={`https://archive.org/details/${
              encodeURIComponent(item.identifier)
            }`}
            target="_blank"
            rel="noreferrer"
          >
            View Archive source
          </a>
          <button
            className="button-secondary"
            onClick={() => run(() => importBook(item.identifier))}
          >
            Import or resume draft
          </button>
        </article>
      ))}
    </section>
  );
}
