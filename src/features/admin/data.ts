import type { AppServices } from "../../app/services";
import { sha256 } from "viem";
import { checkoutKey } from "../payments/checkoutKey";

export type Client = NonNullable<AppServices["supabase"]>;
type Result<T> = { data: T | null; error: { message: string } | null };
export function checked<T>(result: Result<T>): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) {
    throw new Error("Record unavailable. Refresh the dashboard.");
  }
  return result.data;
}
async function rows<T>(query: (start: number) => PromiseLike<Result<T[]>>) {
  const all: T[] = [];
  for (let start = 0;; start += 250) {
    const page = checked(await query(start));
    all.push(...page);
    if (page.length < 250) return all;
  }
}
export async function loadAdmin(db: Client, user: string) {
  const role = await db.from("user_roles").select("role").eq("user_id", user)
    .eq("role", "admin").maybeSingle();
  if (role.error) throw new Error(role.error.message);
  if (!role.data) return null;
  const [
    books,
    plans,
    contributors,
    applications,
    loans,
    payments,
    assets,
    licenses,
  ] = await Promise.all([
    rows((i) => db.from("books").select("*").order("id").range(i, i + 249)),
    rows((i) =>
      db.from("borrowing_plans").select("*").order("id").range(i, i + 249)
    ),
    rows((i) =>
      db.from("contributors").select("id,name").order("id").range(i, i + 249)
    ),
    rows((i) =>
      db.from("contributor_applications").select("*").order("created_at", {
        ascending: false,
      }).order("id").range(i, i + 249)
    ),
    rows((i) =>
      db.from("loans").select("*").order("created_at", { ascending: false })
        .order("id").range(i, i + 249)
    ),
    rows((i) =>
      db.from("payments").select("*").eq("environment", "production").order(
        "created_at",
        { ascending: false },
      ).order("id").range(i, i + 249)
    ),
    rows((i) =>
      db.from("book_assets").select("id,book_id,version,chapter_number").order(
        "id",
      ).range(i, i + 249)
    ),
    rows((i) =>
      db.from("book_licenses").select(
        "id,book_id,rights_holder,distribution_permitted,valid_from,valid_until",
      ).order("id").range(i, i + 249)
    ),
  ]);
  return {
    loadedAt: Date.now(),
    books,
    plans,
    contributors,
    applications,
    loans,
    payments,
    assets,
    licenses,
  };
}
export type Dashboard = NonNullable<Awaited<ReturnType<typeof loadAdmin>>>;
export async function upload(
  db: Client,
  book: string,
  file: File,
  kind: "cover" | "chapter",
  version: number,
) {
  const cover = kind === "cover";
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = cover ? extensions[file.type] : "json";
  if (
    !extension || file.size === 0 || file.size > (cover ? 5242880 : 1048576)
  ) {
    throw new Error("Choose a supported file within the upload size limit.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let chapter = 0;
  if (!cover) {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (
      data?.format !== "chapter-text-v1" ||
      !Number.isSafeInteger(data.chapter) || data.chapter < 1 ||
      typeof data.title !== "string" || !data.title.trim() ||
      !Array.isArray(data.paragraphs) ||
      !data.paragraphs.length || data.paragraphs.length > 1000 ||
      !data.paragraphs.every((p: unknown) =>
        typeof p === "string" && p.length <= 20000 && !/[<>]/.test(p)
      )
    ) {
      throw new Error(
        "Use chapter-text-v1 JSON with a positive chapter number, title and plain-text paragraphs.",
      );
    }
    chapter = data.chapter;
  }
  const path = [book, checkoutKey() + "." + extension].join("/");
  const bucket = db.storage.from(cover ? "covers" : "protected-books");
  checked(
    await bucket.upload(path, file, {
      contentType: cover ? file.type : "application/json",
    }),
  );
  const result = cover
    ? await db.from("books").update({ cover_path: path }).eq("id", book).select(
      "id",
    ).single()
    : await db.from("book_assets").upsert({
      book_id: book,
      version,
      chapter_number: chapter,
      object_path: path,
      byte_size: file.size,
      sha256: sha256(bytes).slice(2),
    }, { onConflict: "book_id,version,chapter_number" }).select("id").single();
  // A transport failure can hide a successful commit. Only clean up on a definite database rejection.
  if (result.error && /^\d{5}$/.test(result.error.code)) {
    await bucket.remove([path]);
  }
  checked(result);
}
