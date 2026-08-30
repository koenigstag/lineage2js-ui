# @lineage2js/unreal-l2js-render

The Unreal Engine 2 **asset object model** for Lineage 2 -- terrain, static
meshes, BSP, textures, materials, lights, zones, emitters -- plus the three.js
renderer it was originally written for.

**Vendored** from [realratchet/Lineage2JS](https://github.com/realratchet/Lineage2JS)
(ISC -- see `LICENSE.txt`), branch `stable`, commit
`e9d31055c7c339b28e4f82d5f975b402849466f0`. The upstream repository ships no
LICENSE file; its `package.json` declares ISC, and the standard text with the
author's copyright is reproduced in `LICENSE.txt`. It reads the client's own
binaries and is verified against a disassembly of the retail client -- its
terrain shader cites `ATerrainInfo::Render (0x9bdfb8)` for the `Modulate2X`
pass -- which is why it is the reference rather than a starting point.

Depends on [`@lineage2js/unreal-l2js-core`](../unreal-l2js-core) for package
reading. For what the client actually stores in a map, and why umodel cannot
get at it, see [`packages/assets-server/README.md`](../assets-server/README.md).

## What is built, and what is only vendored

Upstream's entry point (`src/index.ts`) boots a browser app: stylesheets, a
WebGL renderer, physics, a camera controller. This project bakes assets
offline, so what it needs is the layer underneath -- the readers, which are
plain TypeScript with no DOM or WebGL of their own.

`src/unreal-index.ts` (**not upstream**) is that layer's entry point. Building
it pulls in **134 modules** and nothing else: `src/assets/unreal/**`, the core
package, and a handful of utilities. No renderer, no physics, no `dat.gui`.

The three.js half (`src/materials`, `src/objects`, `src/rendering`) is vendored
on disk but not built. It is the reference for the UI-side renderer, and the
place to start when the client grows a real terrain material.

## Build

`node build.mjs` -- esbuild, bundled to `dist/index.js` as ESM for Node.
Upstream's source depends on webpack aliases (`@client`, `@unreal`) that `tsc`
would leave in the output for nothing to resolve; esbuild resolves them at
build time.

`pnpm typecheck` runs `tsc` over the built closure and is **advisory, not part
of `build`**. Upstream is transpiled by babel and never typechecked, so it does
not come out clean under this workspace's settings: the baseline is **113
errors**, all pre-existing looseness in vendored code, spread over ~15 files
with no single dominant cause. Treat a number above that as a regression worth
looking at; do not treat zero as reachable without rewriting someone else's
code.

`smoke.mjs` points the readers at a real client and prints what came back --
map header, terrain, layers, heightmap, and a sweep over every texture in
several packages. It is the actual regression test for the High Five patches:

```bash
node smoke.mjs "D:/Games/Lineage2/L2_HighFive_Client"
```

Last run: 4902 exports, terrain scale `(128, 128, 76)`, a 256x256 `TEXF_G16`
heightmap decoding to world Z `-8870.9 .. 2482.8`, all 8 terrain layers, and
109 textures across 6 packages read with 0 failures.

## High Five patches

Upstream targets **Chronicle 4**. Each patch is commented in place and marked
`Patched for High Five`, so `git log -S "Patched for High Five"` finds them.

- **`src/assets/unreal/un-texture.ts`** -- the real one. High Five textures
  carry a block C4 does not, between the format flag and the mipmaps: 32
  zeroed bytes, the texture's own qualified name, an **HLSL fragment**
  (`float4 texcolor0=tex2D(s[0], ...)`), and a 4-byte trailer that reads
  `08 00 26 03` on every texture checked. Upstream sets `someFlag` and then
  hits a bare `debugger` when bit `0x100` is set, because it never saw it.
  Without this the mip parse starts in the wrong place and every texture in
  the client fails. Verified by upstream's own invariant -- `un-texture.ts`
  asserts the object was consumed exactly -- across 109 textures in 6
  packages, in all three formats present (`G16`, `DXT1`, `P8`).
- **`src/assets/unreal/un-package.ts`** -- `INT64` and `ParamMap` added to the
  struct constructor table. High Five's script packages declare them and C4's
  do not, so `loadNativeClasses()` threw before it finished walking `Core.u`.
  Nothing reads them; they only have to be constructible. These two are the
  complete set -- found by letting the default branch collect names instead of
  throwing, then running the whole client through it.
- **three's exports map** -- `three/src/math/MathUtils` and
  `three/src/renderers/webgl/WebGLCapabilities` are no longer reachable, and
  `generateUUID` / `RAD2DEG` / `clamp` / `lerp` / `mapLinear` are not root
  exports either. Ten files now take them off `MathUtils`.
- **`src/assets/decode-g16.ts`** -- upstream left its `three` import commented
  out, so the file never compiled. G16 is the heightmap format, so it is
  uncommented.
- **`three-global.d.ts`** (not upstream) -- the source says `THREE.Vector3`
  without importing it, which compiled when `@types/three` still published a
  UMD global. Re-declaring the global here keeps ~230 files byte-identical to
  upstream instead of adding an import to each.
- **`@l2js/core` renamed to `@lineage2js/unreal-l2js-core`** throughout, so the
  fork does not squat the upstream package name. A pure scope rename -- 102
  specifiers, mechanical to re-apply after a re-sync.
