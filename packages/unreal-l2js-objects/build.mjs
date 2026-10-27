/**
 * NOT UPSTREAM -- added by this repo (see README.md).
 *
 * Upstream builds this source with webpack, whose aliases (`@client`,
 * `@unreal`) the emitted JavaScript depends on; `tsc` would leave those
 * specifiers in place and nothing could resolve them at runtime. esbuild
 * resolves them at build time instead, so the output is a plain ES module
 * Node can import.
 *
 * Only the Unreal asset layer is bundled -- see src/unreal-index.ts for why
 * the upstream entry point isn't usable here.
 */
import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

const result = await build({
  entryPoints: ["src/unreal-index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  outfile: "dist/index.js",
  sourcemap: true,
  logLevel: "warning",
  // Peer-ish: resolved from the consumer's node_modules, not inlined.
  external: ["three", "uuid", "pako", "gmp-wasm"],
  alias: {
    "@client": "./src",
    "@unreal": "./src/assets/unreal",
  },
  metafile: true,
});

const inputs = Object.keys(result.metafile.inputs).length;
console.log(`bundled ${inputs} modules -> dist/index.js`);
