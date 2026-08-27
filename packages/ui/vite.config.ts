import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Emits datapacks/versions.json -- a map of every public/ table to a hash of
 * its contents -- so the client can cache those tables across deploys. See
 * src/lib/datapack-cache.ts for what consumes it and why the host's own
 * caching isn't enough on its own.
 *
 * Build only, deliberately. In dev there is no manifest, datapack-cache
 * falls through to a plain fetch, and editing a table shows up on reload
 * instead of being pinned by a cache that nothing invalidates.
 */
function datapackVersionsPlugin(publicDir: string): Plugin {
  return {
    name: "datapack-versions",
    apply: "build",
    async generateBundle() {
      const versions: Record<string, string> = {};

      const walk = async (dir: string): Promise<void> => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
          const absolute = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(absolute);
          } else if (entry.name.endsWith(".json")) {
            const contents = await fs.readFile(absolute);
            versions[path.relative(publicDir, absolute).split(path.sep).join("/")] =
              crypto.createHash("sha256").update(contents).digest("hex").slice(0, 12);
          }
        }
      };
      await walk(publicDir);

      this.emitFile({
        type: "asset",
        fileName: "datapacks/versions.json",
        source: JSON.stringify(Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)))),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), datapackVersionsPlugin(path.resolve(__dirname, "public"))],
  resolve: {
    alias: {
      // Consume @lineage2js/network straight from its TypeScript source so it's
      // bundled and hot-reloaded as part of this Vite build, instead of depending
      // on a separately built (and possibly stale) dist/ output.
      "@lineage2js/network": path.resolve(__dirname, "../network/src/index.ts"),
    },
  },
  // @lineage2js/network fires events keyed off packet.constructor.name (e.g.
  // "PacketReceived:ItemList") and logs via this.constructor.name -- esbuild's
  // minifier renames class declarations by default, which would silently break
  // both. Keep runtime names so minified production builds match dev behavior.
  esbuild: {
    keepNames: true,
  },
});
