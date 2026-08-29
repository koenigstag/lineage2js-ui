import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "127.0.0.1";
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

/**
 * A short token per file that changes whenever the file does, from the same
 * size+mtime the ETag below is built from.
 */
async function assetVersions(relativeDir: string): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  let entries;
  try {
    entries = await fs.readdir(path.join(ASSETS_DIR, relativeDir), { withFileTypes: true });
  } catch {
    return versions;
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    const stats = await fs.stat(path.join(ASSETS_DIR, relativeDir, entry.name));
    versions[entry.name] = `${stats.size.toString(36)}-${Math.round(stats.mtimeMs).toString(36)}`;
  }
  return versions;
}

/**
 * Lets a client cache the models hard and still never serve a stale one: it
 * reads this first and hangs each file's token off its URL, so a re-converted
 * body arrives under a URL the browser has never seen.
 *
 * Without it the only thing standing between a redeploy and a stale body is
 * the max-age below -- an hour of the old model, or a hard reload, which is
 * not something to ask of everyone who happens to be logged in.
 *
 * Uncacheable itself, for obvious reasons, and computed per request rather
 * than generated as a file: sixteen stat() calls cost nothing next to the
 * megabytes it governs, and there is no build step to forget.
 */
app.get("/highfive/models/versions.json", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await assetVersions("highfive/models"));
});

/** A token for a whole folder, changing whenever any file in it does -- the textures of one rig move together. */
async function directoryVersion(relativeDir: string): Promise<string> {
  const versions = await assetVersions(relativeDir);
  const combined = Object.keys(versions)
    .sort()
    .map((name) => versions[name])
    .join("|");
  let hash = 0;
  for (let i = 0; i < combined.length; i++) hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/**
 * The texture manifest: which parts each rig has, how many variants of the two
 * that vary, and a token per rig for hanging off the URLs (see
 * assets-server/scripts/convert-client-rigs.ts and the UI's
 * config/character-textures.ts).
 *
 * Uncacheable for the same reason the model versions above are, and it bites
 * harder: a client holding a stale copy doesn't merely fetch an old texture,
 * it never asks for the ones that have appeared since -- a rig added to the
 * set stays flat-tinted until the copy expires.
 *
 * The token is per rig rather than per file because that is how they are
 * produced: one conversion run rewrites all of a rig's textures at once, and
 * a re-export of the whole set is the only thing that changes any of them.
 */
app.get("/highfive/textures/index.json", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  let manifest: Record<string, Record<string, unknown>>;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(ASSETS_DIR, "highfive/textures/index.json"), "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
  } catch {
    res.json({});
    return;
  }
  for (const rig of Object.keys(manifest)) {
    manifest[rig].v = await directoryVersion(`highfive/textures/${rig}`);
  }
  res.json(manifest);
});

// Login screen background counts -- the UI picks a random id in [1, count]
// and requests it as a regular static file (see below), so this only needs
// to report how many numbered variants currently exist in each folder.

// Serving assets/skills/{id}.png, assets/items/{id}.png, ... directly under
// their matching URL path -- no extra routing needed, express.static resolves
// GET /skills/1234.png to ASSETS_DIR/skills/1234.png.
app.use(
  express.static(ASSETS_DIR, {
    etag: true, // adds ETag from file size+mtime; enables conditional GETs
    lastModified: true,
    setHeaders(res, filePath) {
      res.setHeader("Cache-Control", `public, max-age=${MAX_AGE_SECONDS}, must-revalidate`);
      // .cur isn't in the default mime-db this package's Content-Type
      // sniffing uses, so it would otherwise fall back to
      // application/octet-stream. Browsers apply a CSS `cursor: url(...)`
      // by sniffing the file's own bytes regardless of this header, but
      // there's no reason to serve the wrong type when the right one is
      // this cheap -- same de facto type browsers themselves report for a
      // same-format .ico.
      if (filePath.toLowerCase().endsWith(".cur")) {
        res.setHeader("Content-Type", "image/x-icon");
      }
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, HOST, () => {
  console.log(`Assets server listening on http://${HOST}:${PORT}`);
});
