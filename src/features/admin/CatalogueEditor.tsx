import { type FormEvent, useState } from "react";
import { parseUnits } from "viem";
import { checked, type Client, type Dashboard, upload } from "./data";
import { formatUsdt } from "../catalogue/catalogue";

export type Run = (work: () => Promise<void>) => void;
export function CatalogueEditor(
  { db, data, user, run }: {
    db: Client;
    data: Dashboard;
    user: string;
    run: Run;
  },
) {
  const [id, select] = useState("");
  const book = data.books.find((b) => b.id === id);
  const plans = data.plans.filter((p) => p.book_id === id);
  const assets = data.assets.filter((a) => a.book_id === id);
  const version = Math.max(1, ...assets.map((a) => a.version));
  function form(action: (fields: FormData) => Promise<void>) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      run(() => action(fields));
    };
  }
  const field = (f: FormData, name: string) => String(f.get(name) ?? "").trim();
  return (
    <section className="admin-editor">
      <label>
        Catalogue book<select
          value={id}
          onChange={(e) => select(e.target.value)}
        >
          <option value="">Create a book</option>
          {data.books.map((b) => (
            <option key={b.id} value={b.id}>{b.title} · {b.status}</option>
          ))}
        </select>
      </label>
      <form
        key={"metadata-" + (book?.id ?? "new")}
        onSubmit={form(async (f) => {
          const contributor = field(f, "owner");
          const values = {
            title: field(f, "Title"),
            author: field(f, "Author"),
            category: field(f, "Category"),
            description: field(f, "Description"),
            public_preview: field(f, "Public preview"),
            cover_alt: field(f, "Cover description"),
            ownership: contributor
              ? "contributor" as const
              : "platform" as const,
            contributor_id: contributor || null,
          };
          const saved = checked<{ id: string }>(
            await (book
              ? db.from("books").update(values).eq("id", id)
              : db.from("books").insert(values)).select("id").single(),
          );
          select(saved.id);
        })}
      >
        <h2>{book ? "Edit book" : "New draft"}</h2>
        {([["Title", book?.title], ["Author", book?.author], [
          "Category",
          book?.category,
        ], ["Cover description", book?.cover_alt]] as const).map((
          [name, value],
        ) => (
          <label key={name}>
            {name}
            <input
              name={name}
              defaultValue={value}
              required={name !== "Cover description"}
            />
          </label>
        ))}
        <label>
          Description<textarea
            name="Description"
            defaultValue={book?.description}
          />
        </label>
        <label>
          Public preview<textarea
            name="Public preview"
            defaultValue={book?.public_preview}
          />
        </label>
        <label>
          Revenue owner<select
            name="owner"
            defaultValue={book?.contributor_id ?? ""}
          >
            <option value="">Virtual Library</option>
            {data.contributors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button className="button-primary">
          {book ? "Save book" : "Create draft"}
        </button>
      </form>
      {book && (
        <div key={book.id}>
          <h2>Borrowing plans</h2>
          {[3, 7, 14].map((days) => {
            const plan = plans.find((p) => p.duration_days === days);
            return (
              <form
                key={days}
                onSubmit={form(async (f) => {
                  const price = field(f, "price");
                  if (!/^\d+(\.\d{1,6})?$/.test(price)) {
                    throw new Error(
                      "Enter a USDT price with up to six decimal places.",
                    );
                  }
                  const units = parseUnits(price, 6);
                  if (units < 1n || units > BigInt(Number.MAX_SAFE_INTEGER)) {
                    throw new Error("Price outside the supported range.");
                  }
                  checked(
                    await db.from("borrowing_plans").upsert({
                      book_id: id,
                      duration_days: days,
                      price_units: Number(units),
                      enabled: f.has("enabled"),
                    }, { onConflict: "book_id,duration_days" }).select("id")
                      .single(),
                  );
                })}
              >
                <label>
                  {days}-day fee in USDT<input
                    name="price"
                    inputMode="decimal"
                    required
                    defaultValue={plan ? formatUsdt(plan.price_units) : ""}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={plan?.enabled}
                  />{" "}
                  Enabled
                </label>
                <button className="button-secondary">
                  Save {days}-day plan
                </button>
              </form>
            );
          })}
          <h2>Files</h2>
          <p>
            Current edition chapters:{" "}
            {assets.filter((a) => a.version === version).map((a) =>
              a.chapter_number
            ).sort((a, b) => a - b).join(", ") || "None"}
          </p>
          {(["cover", "chapter"] as const).map((kind) => (
            <form
              key={kind}
              onSubmit={form(async (f) => {
                const file = f.get("file");
                if (!(file instanceof File)) {
                  throw new Error("Select a file.");
                }
                await upload(db, id, file, kind, version);
              })}
            >
              <label>
                {kind === "cover"
                  ? "Cover image (PNG, JPEG or WebP, up to 5 MiB)"
                  : "Private chapter (chapter-text-v1 JSON, up to 1 MiB)"}
                <input
                  name="file"
                  type="file"
                  accept={kind === "cover"
                    ? "image/png,image/jpeg,image/webp"
                    : ".json"}
                  required
                />
              </label>
              <button className="button-secondary">Upload {kind}</button>
            </form>
          ))}
          <h2>Distribution rights</h2>
          {data.licenses.filter((l) => l.book_id === id).map((l) => (
            <p key={l.id}>
              {l.rights_holder} · {l.distribution_permitted
                ? "Permission recorded"
                : "Permission withheld"}
            </p>
          ))}
          <form
            onSubmit={form(async (f) => {
              checked(
                await db.from("book_licenses").insert({
                  book_id: id,
                  rights_holder: field(f, "holder"),
                  rights_evidence: field(f, "evidence"),
                  reviewed_by: user,
                  reviewed_at: new Date().toISOString(),
                  distribution_permitted: true,
                }).select("id").single(),
              );
            })}
          >
            <label>
              Rights holder<input name="holder" required />
            </label>
            <label>
              Evidence of distribution permission<textarea
                name="evidence"
                required
              />
            </label>
            <button className="button-secondary">
              Record distribution permission
            </button>
          </form>
          <h2>Publication</h2>
          <p>Current status: {book.status}</p>
          <button
            className="button-primary"
            onClick={() =>
              run(async () => {
                if (
                  book.status !== "published" &&
                  (!plans.some((p) => p.enabled) || !assets.some((a) =>
                    a.version === version && a.chapter_number === 1
                  ))
                ) {
                  throw new Error(
                    "Add chapter 1 and enable a borrowing plan before publishing.",
                  );
                }
                checked(
                  await db.from("books").update({
                    status: book.status === "published" ? "draft" : "published",
                  }).eq("id", id).select("id").single(),
                );
              })}
          >
            {book.status === "published" ? "Unpublish book" : "Publish book"}
          </button>
        </div>
      )}
    </section>
  );
}
