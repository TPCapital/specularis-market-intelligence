// scripts/dev-server.js — Specularis v9 local dev server
// Usage: node scripts/dev-server.js
// Serves static files + proxies /api/* to Vercel functions via node

import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = process.env.PORT || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
};

function serve(res, filePath, status = 200) {
  const ext = extname(filePath);
  const body = readFileSync(filePath);
  res.writeHead(status, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // API routes
  if (path.startsWith("/api/")) {
    const apiName = path.replace("/api/", "").split("?")[0];
    const apiFile = join(ROOT, "api", `${apiName}.js`);
    if (existsSync(apiFile)) {
      try {
        const mod = await import(`${apiFile}?t=${Date.now()}`);
        const handler = mod.default;
        if (typeof handler === "function") {
          const fakeReq = Object.assign(req, {
            query: Object.fromEntries(url.searchParams.entries()),
            body: {},
          });
          await handler(fakeReq, res);
          return;
        }
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
    res.writeHead(404); res.end("API not found");
    return;
  }

  // Static files
  let filePath = join(ROOT, path === "/" ? "index.html" : path);
  if (!existsSync(filePath)) filePath = join(ROOT, "index.html");
  if (existsSync(filePath)) { serve(res, filePath); return; }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n⚡ Specularis v9 dev server running at http://127.0.0.1:${PORT}\n`);
  console.log("   Note: API endpoints require valid environment variables to return live data.");
  console.log("   Set FINNHUB_API_KEY etc. in your shell before starting.\n");
});
