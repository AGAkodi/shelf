// Shared server handler. No client-supplied identity, price, path, or success flag is trusted.
/** @param {{ server: import("npm:@supabase/supabase-js@2.118.0").SupabaseClient, development?: boolean, origins?: string[] }} options */
export function createHandler({ server, development = false, origins = [] }) {
  const uuid = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  return async (request) => {
    const origin = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    };
    if (origin && !origins.includes(origin))
      return new Response('{"error":"Origin denied"}', {
        status: 403,
        headers,
      });
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    const respond = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return respond({ error: "Method not allowed" }, 405);
    try {
      const bearer = request.headers.get("authorization");
      if (!bearer?.startsWith("Bearer "))
        return respond({ error: "Sign in required" }, 401);
      const { data: auth, error: authError } = await server.auth.getUser(
        bearer.slice(7),
      );
      if (authError || !auth.user)
        return respond({ error: "Sign in required" }, 401);
      const user = auth.user.id;
      const reader = request.body?.getReader();
      let text = "",
        size = 0;
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 8192) {
            await reader.cancel();
            return respond({ error: "Request too large" }, 413);
          }
          text += new TextDecoder().decode(value);
        }
      }
      const body = JSON.parse(text);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return respond({ error: "Invalid request" }, 400);
      const rpc = async (name, args) => {
        const { data, error } = await server.rpc(name, args);
        if (error)
          throw Object.assign(new Error("Request denied"), {
            status: error.code === "42501" ? 403 : 409,
          });
        return data;
      };
      if (body.action === "library")
        return respond(await rpc("library_state", { p_user: user }));
      if (body.action === "return" && uuid(body.loanId))
        return respond(
          await rpc("return_loan", { p_user: user, p_loan: body.loanId }),
        );
      if (["checkout", "complete", "cancel"].includes(body.action)) {
        if (!development)
          return respond({ error: "Development adapter disabled" }, 403);
        if (
          body.action === "checkout" &&
          uuid(body.bookId) &&
          uuid(body.planId) &&
          uuid(body.key)
        )
          return respond(
            await rpc("dev_checkout", {
              p_user: user,
              p_book: body.bookId,
              p_plan: body.planId,
              p_key: body.key,
            }),
          );
        if (uuid(body.paymentId) && body.action !== "checkout")
          return respond(
            await rpc(
              body.action === "complete" ? "dev_complete" : "dev_cancel",
              { p_user: user, p_payment: body.paymentId },
            ),
          );
        return respond({ error: "Invalid checkout request" }, 400);
      }
      if (
        body.action === "read" &&
        uuid(body.loanId) &&
        uuid(body.bookId) &&
        Number.isInteger(body.chapter) &&
        body.chapter > 0
      ) {
        const args = {
          p_user: user,
          p_loan: body.loanId,
          p_book: body.bookId,
          p_chapter: body.chapter,
        };
        const asset = await rpc("authorize_chapter", args);
        const { data: blob, error } = await server.storage
          .from("protected-books")
          .download(asset.object_path);
        if (
          error ||
          !blob ||
          blob.size > 1048576 ||
          blob.size !== asset.byte_size
        )
          return respond({ error: "Chapter unavailable" }, 503);
        const bytes = await blob.arrayBuffer();
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (n) => n.toString(16).padStart(2, "0"),
        ).join("");
        if (digest !== asset.sha256)
          return respond({ error: "Chapter unavailable" }, 503);
        const chapter = JSON.parse(new TextDecoder().decode(bytes));
        if (
          chapter.format !== "chapter-text-v1" ||
          chapter.chapter !== body.chapter ||
          typeof chapter.title !== "string" ||
          !Array.isArray(chapter.paragraphs) ||
          chapter.paragraphs.length > 1000 ||
          !chapter.paragraphs.every(
            (p) =>
              typeof p === "string" && p.length <= 20000 && !/[<>]/.test(p),
          )
        )
          return respond({ error: "Invalid chapter format" }, 503);
        // Recheck after storage I/O: return/expiry while downloading must deny this response.
        const checked = await rpc("authorize_chapter", args);
        return respond({
          title: chapter.title,
          paragraphs: chapter.paragraphs,
          chapter: body.chapter,
          chapters: checked.chapters,
          expires_at: checked.expires_at,
          server_time: checked.server_time,
        });
      }
      return respond({ error: "Invalid request" }, 400);
    } catch (error) {
      return respond(
        {
          error:
            error instanceof SyntaxError
              ? "Invalid request"
              : "Unable to complete request",
        },
        error instanceof SyntaxError ? 400 : (error.status ?? 500),
      );
    }
  };
}
