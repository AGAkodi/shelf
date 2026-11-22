import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { allowedOrigins } from "../_shared/origins.ts";
import {
  archiveBytes,
  archiveFetch,
  chaptersFromText,
  cleanText,
  textFiles,
} from "./source.ts";
const url = Deno.env.get("SUPABASE_URL") ?? "";
const server = createClient(
  url,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const local = [
  "http://kong:8000",
  "http://supabase_kong_shelf:8000",
  "http://127.0.0.1:55321",
].includes(url);
const origins = allowedOrigins(
  local,
  Deno.env.get("SHELF_ALLOWED_ORIGINS") ?? "",
);
Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Origin": origins.includes(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  const send = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (!origins.includes(origin)) return send({ error: "Origin denied" }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return send({ error: "Method denied" }, 405);
  try {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const auth = await server.auth.getUser(token);
    if (auth.error || !auth.data.user) {
      return send({ error: "Sign in required" }, 401);
    }
    const role = await server.from("user_roles").select("role").eq(
      "user_id",
      auth.data.user.id,
    ).eq("role", "admin").maybeSingle();
    if (role.error || !role.data) {
      return send({ error: "Administrator access required" }, 403);
    }
    const raw = await request.text();
    if (raw.length > 2048) return send({ error: "Request too large" }, 413);
    const body = JSON.parse(raw);
    if (body.action === "search") {
      if (
        typeof body.query !== "string" || body.query.length < 2 ||
        body.query.length > 160
      ) return send({ error: "Enter 2–160 characters." }, 400);
      const query = cleanText(body.query, 160).replace(
        /[^\p{L}\p{N} -]/gu,
        " ",
      );
      const target = new URL("https://archive.org/advancedsearch.php");
      target.searchParams.set(
        "q",
        `mediatype:texts AND (format:"DjVuTXT" OR format:"Text" OR format:"OCR Search Text") AND (title:("${query}") OR creator:("${query}"))`,
      );
      target.searchParams.set("output", "json");
      target.searchParams.set("rows", "20");
      for (const field of ["identifier", "title", "creator", "licenseurl"]) {
        target.searchParams.append("fl[]", field);
      }
      const result = JSON.parse(await archiveFetch(target.href));
      const candidates = (result.response?.docs ?? []).filter((
        d: Record<string, unknown>,
      ) =>
        typeof d.identifier === "string" &&
        /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(d.identifier)
      );
      const items: {
        identifier: string;
        title: string;
        author: string;
        license: string;
      }[] = [];
      for (let start = 0; start < candidates.length; start += 4) {
        const batch = await Promise.all(
          candidates.slice(start, start + 4).map(
            async (d: Record<string, string>) => {
              try {
                const item = JSON.parse(
                  await archiveFetch(
                    "https://archive.org/metadata/" + d.identifier,
                  ),
                );
                for (const file of textFiles(item)) {
                  try {
                    const text = await archiveFetch(
                      `https://archive.org/download/${d.identifier}/${
                        encodeURIComponent(file.name)
                      }`,
                    );
                    if (text.trim()) {
                      return {
                        identifier: d.identifier,
                        title: cleanText(d.title, 240),
                        author: cleanText(d.creator, 240),
                        license: cleanText(d.licenseurl, 1000),
                      };
                    }
                  } catch { /* Try another public text file. */ }
                }
              } catch { /* Exclude items that cannot be verified. */ }
              return null;
            },
          ),
        );
        items.push(
          ...batch.filter((item): item is NonNullable<typeof item> =>
            item !== null
          ),
        );
      }
      return send({ items });
    }
    if (
      body.action !== "import" || typeof body.identifier !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(body.identifier)
    ) {
      return send({ error: "Invalid Archive identifier" }, 400);
    }
    const item = JSON.parse(
      await archiveFetch("https://archive.org/metadata/" + body.identifier),
    );
    const meta = item.metadata;
    if (
      !meta || meta.mediatype !== "texts" || meta.access_restricted === true ||
      meta.access_restricted === "true" || meta.is_dark
    ) {
      return send({ error: "This item cannot be imported." }, 400);
    }
    const files = textFiles(item);
    if (!files.length) {
      return send({
        error:
          "This item has no downloadable plain-text edition. Choose another book.",
      }, 400);
    }
    let text = "";
    for (const file of files) {
      try {
        text = await archiveFetch(
          `https://archive.org/download/${body.identifier}/${
            encodeURIComponent(file.name)
          }`,
        );
        if (text.trim()) break;
      } catch { /* Try the next downloadable text edition. */ }
    }
    if (!text.trim()) {
      return send({
        error: "The text is temporarily unavailable. Please search again.",
      }, 503);
    }
    const chapters = chaptersFromText(text);
    const title = cleanText(meta.title, 240) || body.identifier;
    const author = cleanText(meta.creator, 240) || "Unknown author";
    const subjects = Array.isArray(meta.subject)
      ? meta.subject
      : [meta.subject];
    const category = subjects.map((subject: unknown) =>
      cleanText(subject, 80)
    ).find(Boolean) || "Uncategorized";
    const preview = chapters.flatMap((chapter) =>
      chapter.paragraphs
    ).join(" ").slice(0, 800);
    let cover: string | null = null;
    const coverFiles = (Array.isArray(item.files) ? item.files : []).filter(
      (file: { name?: unknown; private?: unknown }) =>
        typeof file.name === "string" &&
        /(?:^|[_. -])(front[_. -]?)?cover(?:[_. -]|$).*\.jpe?g$/i.test(
          file.name,
        ) &&
        file.private !== true && file.private !== "true",
    );
    const coverUrls = coverFiles.map((file: { name: string }) =>
      `https://archive.org/download/${body.identifier}/${
        encodeURIComponent(file.name)
      }`
    );
    coverUrls.push(`https://archive.org/services/img/${body.identifier}`);
    for (const url of coverUrls) {
      try {
        const bytes = await archiveBytes(url);
        if (
          bytes.length <= 1048576 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
          bytes[2] === 0xff
        ) {
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          cover = btoa(binary);
          break;
        }
      } catch { /* Try the next image from this edition. */ }
    }
    return send({
      identifier: body.identifier,
      title,
      author,
      category,
      cover_alt: `Cover of ${title}`.slice(0, 300),
      cover,
      public_preview: preview,
      rights_holder: cleanText(
        Array.isArray(meta.creator) ? meta.creator[0] : meta.creator,
        240,
      ) ||
        "Unknown author",
      description: cleanText(meta.description, 10000),
      license: cleanText(meta.licenseurl ?? meta.rights, 2000),
      chapters,
    });
  } catch (error) {
    return send({
      error: error instanceof Error ? error.message : "Archive request failed",
    }, 502);
  }
});
