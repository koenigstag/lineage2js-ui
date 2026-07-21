import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
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
