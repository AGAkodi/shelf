const maximumBytes = 4 * 1024 * 1024;
export function textFiles(
  item: {
    metadata?: Record<string, unknown>;
    is_dark?: unknown;
    files?: unknown;
  },
) {
  const meta = item.metadata;
  if (
    !meta || meta.mediatype !== "texts" || item.is_dark || meta.is_dark ||
    meta.access_restricted === true || meta.access_restricted === "true" ||
    !Array.isArray(item.files)
  ) return [];
  return item.files.filter((
    file: {
      name?: unknown;
      format?: unknown;
      private?: unknown;
      size?: unknown;
    },
  ) =>
    typeof file.name === "string" && /\.txt$/i.test(file.name) &&
    (file.format === "DjVuTXT" || file.format === "Text" ||
      file.format === "OCR Search Text" || file.name.endsWith("_djvu.txt")) &&
    file.private !== true && file.private !== "true" &&
    (file.size === undefined ||
      (/^\d+$/.test(String(file.size)) && Number(file.size) > 0 &&
        Number(file.size) <= maximumBytes))
  ) as { name: string }[];
}
export function archiveUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    !(url.hostname === "archive.org" || url.hostname.endsWith(".archive.org"))
  ) {
    throw new Error("Invalid Archive download address");
  }
  return url;
}
export async function archiveBytes(address: string): Promise<Uint8Array> {
  let url = archiveUrl(address);
  for (let redirects = 0; redirects < 5; redirects++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "ShelfLibrary/1.0 (administrator requested book import)",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Archive download unavailable");
      url = archiveUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        "Archive is unavailable or the file is restricted. Try again later.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty Archive response");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > maximumBytes) {
          throw new Error("This import exceeds the 4 MiB text limit.");
        }
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  throw new Error("Too many download redirects");
}
export async function archiveFetch(address: string): Promise<string> {
  return new TextDecoder().decode(await archiveBytes(address));
}
export function cleanText(value: unknown, maximum: number): string {
  const text = Array.isArray(value)
    ? value.join("; ")
    : typeof value === "string"
    ? value
    : "";
  return text.replace(/<[^>]*>/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ")
    .trim().slice(0, maximum);
}
export function chaptersFromText(text: string) {
  const paragraphs = text.replace(/[<>]/g, "").replace(/\r/g, "").split(
    /\n\s*\n/,
  )
    .flatMap((p) => p.trim().match(/[\s\S]{1,8000}/g) ?? []);
  if (!paragraphs.length) throw new Error("The source text is empty.");
  const chapters: {
    format: string;
    chapter: number;
    title: string;
    paragraphs: string[];
  }[] = [];
  let group: string[] = [], length = 0;
  for (const paragraph of paragraphs) {
    if (length + paragraph.length > 50000 && group.length) {
      chapters.push({
        format: "chapter-text-v1",
        chapter: chapters.length + 1,
        title: `Section ${chapters.length + 1}`,
        paragraphs: group,
      });
      group = [];
      length = 0;
    }
    group.push(paragraph);
    length += paragraph.length;
  }
  if (group.length) {
    chapters.push({
      format: "chapter-text-v1",
      chapter: chapters.length + 1,
      title: `Section ${chapters.length + 1}`,
      paragraphs: group,
    });
  }
  return chapters;
}
