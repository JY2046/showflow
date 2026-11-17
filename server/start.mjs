import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFirebaseConfigMiddleware } from "./firebase-config.mjs";
import { createApiMiddleware } from "./api.mjs";
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../dist/client",
  ),
  api = createApiMiddleware(),
  firebase = createFirebaseConfigMiddleware();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/showflow/")) {
    req.url = url.pathname.slice("/api/showflow".length);
    return firebase(req, res, () => api(req, res, () => {
      res.writeHead(404);
      res.end("Not found");
    }));
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const decoded = decodeURIComponent(url.pathname);
    let file = path.resolve(root, "." + decoded);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    let content;
    try {
      content = await fs.readFile(file);
    } catch {
      if (!req.headers.accept?.includes("text/html")) {
        res.writeHead(404);
        res.end();
        return;
      }
      file = path.join(root, "index.html");
      content = await fs.readFile(file);
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": file.endsWith("index.html")
        ? "no-store"
        : "public, max-age=300",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(500);
    res.end("Build the app before starting.");
  }
});
server.requestTimeout = 600000;
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
  console.log(
    "ShowFlow running locally on http://localhost:" +
      (process.env.PORT || 4173),
  ),
);
