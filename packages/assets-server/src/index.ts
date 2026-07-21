import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 4000);
const ASSETS_DIR = process.env.ASSETS_DIR ?? path.join(__dirname, "../assets");
// Browser trusts its cached copy for this long, then re-validates with a
// conditional GET (If-None-Match) instead of blindly re-downloading or
// blindly trusting a stale copy forever.
const MAX_AGE_SECONDS = Number(process.env.MAX_AGE_SECONDS ?? 60 * 60);

const app = express();

// Public, read-only static assets meant to be pulled from a different origin
// (the UI dev server, a CDN, ...), so every response -- including the JSON
// count endpoints below -- is CORS-open.
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

async function countAssetFiles(relativeDir: string): Promise<number> {
  try {
    const entries = await fs.readdir(path.join(ASSETS_DIR, relativeDir), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && !entry.name.startsWith(".")).length;
  } catch {
    return 0;
  }
}

// Login screen background counts -- the UI picks a random id in [1, count]
// and requests it as a regular static file (see below), so this only needs
// to report how many numbered variants currently exist in each folder.
app.get("/legacy/images/titlescreens/count", async (_req, res) => {
  res.json({ count: await countAssetFiles("legacy/images/titlescreens") });
});

app.get("/legacy/videos/titlescreens/count", async (_req, res) => {
  res.json({ count: await countAssetFiles("legacy/videos/titlescreens") });
});

// Serving assets/skills/{id}.png, assets/items/{id}.png, ... directly under
// their matching URL path -- no extra routing needed, express.static resolves
// GET /skills/1234.png to ASSETS_DIR/skills/1234.png.
app.use(
  express.static(ASSETS_DIR, {
    etag: true, // adds ETag from file size+mtime; enables conditional GETs
    lastModified: true,
    setHeaders(res) {
      res.setHeader("Cache-Control", `public, max-age=${MAX_AGE_SECONDS}, must-revalidate`);
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Assets server listening on http://localhost:${PORT}`);
});
