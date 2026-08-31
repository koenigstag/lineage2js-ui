import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Serves three's Basis transcoder at /basis/, which KTX2Loader needs to turn a
 * .ktx2 into whatever compressed format the viewer's GPU actually speaks (see
 * utils/world/static-mesh-cache.ts).
 *
 * Copied out of node_modules rather than committed: the two files are 585kB of
 * build output belonging to three, and a transcoder that drifts from the three
 * version it ships with is a bug waiting to happen. Dev serves them straight
 * from disk; a build emits them next to the bundle.
 */
function basisTranscoderPlugin(): Plugin {
  const source = path.dirname(require.resolve("three/examples/jsm/libs/basis/basis_transcoder.js"));
  const files = ["basis_transcoder.js", "basis_transcoder.wasm"];

  return {
    name: "basis-transcoder",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = files.find((file) => req.url?.endsWith(`/basis/${file}`));
        if (!name) return next();
        res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        fs.readFile(path.join(source, name)).then(
          (contents) => res.end(contents),
          () => next()
        );
      });
    },
    async generateBundle() {
      for (const name of files) {
        this.emitFile({
          type: "asset",
          fileName: `basis/${name}`,
          source: await fs.readFile(path.join(source, name)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), basisTranscoderPlugin()],
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
