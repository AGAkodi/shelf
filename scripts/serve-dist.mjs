// Serves dist/ with the headers and SPA rewrite declared in vercel.json, so the production
// Content-Security-Policy can be tested locally against the real build. Test tooling only.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { root } from "./lib/local-supabase.mjs";

const dist = join(root, "dist");
const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const port = Number(process.env.SHELF_DIST_PORT ?? 4174);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json", ".map": "application/json",
};
const match = (source, path) => new RegExp("^" + source + "$").test(path);

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  for (const rule of config.headers) {
    if (match(rule.source, path)) for (const h of rule.headers) res.setHeader(h.key, h.value);
  }
  let file = normalize(join(dist, path));
  if (!file.startsWith(dist)) {
    res.writeHead(400).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const rewrite = config.rewrites.find((r) => match(r.source, path));
    if (!rewrite) {
      res.writeHead(404).end("Not found");
      return;
    }
    file = join(dist, rewrite.destination);
  }
  res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => console.log(`dist with vercel.json headers on http://127.0.0.1:${port}`));
