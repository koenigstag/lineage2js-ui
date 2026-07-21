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
});
