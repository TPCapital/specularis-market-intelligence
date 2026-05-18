import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "../api/snapshot.js";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === "/api/snapshot") {
      return sendJson(res, 200, await buildSnapshot({ query: Object.fromEntries(url.searchParams.entries()) }));
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 501, { error: "Adapter not configured; frontend fallback will be used." });
    }
  } catch (error) {
    return sendJson(res, 502, { error: "Upstream unavailable", detail: error.message });
  }

  return false;
}

async function handleStatic(res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    const body = await readFile(join(root, "index.html"));
    res.writeHead(200, { "Content-Type": mime[".html"], "Cache-Control": "no-store" });
    res.end(body);
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  await handleStatic(res, url);
}).listen(port, "0.0.0.0", () => {
  console.log(`Dashboard dev server running at http://127.0.0.1:${port}`);
  console.log("For phone testing, use your Mac LAN IP, for example http://192.168.x.x:" + port);
});
