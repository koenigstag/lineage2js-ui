# @lineage2js/unreal-l2js-core

Unreal Engine 2 package reader for Lineage 2 client files: the name/import/
export tables, tagged properties, the struct/class machinery the readers build
objects from, and L2's own file encryption.

**Vendored** from [realratchet/l2js-core](https://github.com/realratchet/l2js-core)
(ISC -- see `LICENSE.txt`), branch `stable`, commit
`39110d1051f3621a45c5c71b9269383d8b3efde5`. The upstream repository ships no
LICENSE file; its `package.json` declares ISC, and the standard text with the
author's copyright is reproduced in `LICENSE.txt`.

The companion package is [`@lineage2js/unreal-l2js-objects`](../unreal-l2js-objects),
vendored from the same author's renderer; between them they are what reads the
world out of `.unr` maps, which no off-the-shelf tool does (see
[`packages/assets-server/README.md`](../assets-server/README.md) for what
umodel does and does not cover).

## Why a fork rather than a dependency

Upstream targets **Chronicle 4**; this project targets **High Five**. The
differences are small but real, they have to live in the source, and upstream
takes no bug reports. Keeping a fork also removes a `git+ssh` dependency from
the workspace.

## Divergence from upstream

Kept deliberately small, so re-syncing stays "copy `src/` over, re-apply
these". Every patch is commented in place, and each one is marked in the
source so `git log -S` finds it.

- **`src/unreal/un-object.ts`** -- declared the `make` / `class` statics that
  `un-object-mixin.ts` (in the objects package) installs on every subclass at
  runtime. Upstream declares them only in a `declare module` augmentation,
  which cannot merge onto an existing class, so several hundred call sites in
  the objects package had no types for them. Declaration only; emits nothing.
- **`src/crypto/decryption/decrypt-rsa.ts`** -- one `as ArrayBuffer` cast.
  Newer TypeScript lib types a typed array's `.buffer` as `ArrayBufferLike`,
  which admits `SharedArrayBuffer`; pako never allocates one.

Nothing else in `src/` is modified.

## Build

`tsc` per file into `dist/`, with declarations -- the objects package's bundler
resolves deep subpaths (`.../src/unreal/un-array`) through the `exports` map,
which points them at the built output. The emitted JavaScript keeps
extension-less relative imports (upstream is transpiled by babel and bundled
by webpack), so **Node cannot import `dist/` directly** -- a bundler has to
resolve it. The objects package does exactly that and re-exports what a Node
consumer needs.

The tsconfig turns off `strictNullChecks`, `strictPropertyInitialization` and
`useUnknownInCatchVariables`, and turns on `allowJs`. These are the settings
that would otherwise mean rewriting hundreds of lines of someone else's code;
they are relaxed here and nowhere else in the workspace. With them, this
package typechecks **clean**.
