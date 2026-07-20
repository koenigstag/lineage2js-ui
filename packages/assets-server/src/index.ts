import express from "express";
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
