# lineage2js-ui

Monorepo for a Lineage 2 fan/emulator web client: a network protocol library
and a React UI client built on top of it. See README.md for the elevator
pitch; this file is for working in the code.

## Structure

- pnpm workspaces + Turborepo. Packages live in `packages/*`.
- `packages/network` (`@lineage2js/network`) — login/game protocol layer
  (packets, encryption, sockets). Plain TypeScript, compiled with `tsc`. See
  `packages/network/README.md` for protocol reference sources when fixing or
  extending a packet.
- `packages/ui` (`@lineage2js/ui`) — the web client. Vite + React + TypeScript
  + MobX (`mobx-react-lite`). This is where almost all UI work happens.
- `packages/assets-server` (`@lineage2js/assets-server`) — Express static
  server for game icons (skills/items/actions/classes), pre-baked geodata
  tiles, and converted character models. Real files live under
  `assets/highfive/{icons,geodata-tiles,models}/` and are gitignored (only
  the folder structure + `.gitkeep` are tracked) since that art is
  copyrighted -- don't ever commit real icons, geodata or models here or
  anywhere else in this repo. `assets/highfive/datapack/` follows the same
  rule for a different reason: it holds the third-party reference tables
  (item/npc/skill names, system messages, stat tables) that used to ship in
  the UI bundle out of `packages/ui/public/`, and were moved here to keep
  that data out of the repository. It is the one asset folder whose absence
  changes what the UI *says* rather than how it looks -- every name degrades
  to its raw id -- so `pnpm dev:assets-server` is part of normal UI work now,
  not just art work. Client-UI art belongs here too rather than in
  the UI bundle, under the same rule -- the game menu's own button icons are
  `assets/highfive/icons/game-menu/<button>@64.png` (see the UI's
  `config/icon-urls.ts`; every consumer needs a fallback for when the art
  isn't served). Everything lives under `assets/highfive/`; there is no
  second tree. Serves with `Cache-Control: max-age + must-revalidate` and
  an ETag from file size/mtime, so overwriting a file is enough to
  invalidate clients' caches (no URL versioning needed). `scripts/` holds
  the offline converters that produce those files from sources the user
  supplies locally: `convert:geodata` (L2J `.l2j` regions -> tiles),
  `convert:client-rigs` (an installed game client, read with umodel -> one
  `.glb` per race/sex plus its textures under
  `assets/highfive/textures/<rig>/`) and `convert:armorgrp` / `convert:chargrp` /
  `convert:npcstring` (the client's `system/*.dat` tables ->
  `assets/highfive/data/`). `convert:models`, which
  built the ten non-orc bodies out of a Unity port of the client, is
  superseded by `convert:client-rigs` -- kept for now, but nothing depends
  on its output any more.
- The client's `system/*.dat` tables are RSA+zlib, and
  `scripts/client-data/` reads them: `l2-dat.ts` decrypts (with both the
  NCsoft key and the l2encdec one repacked clients use -- the file itself
  picks) and `armorgrp.ts` holds the reversed record schema. It is what
  says which mesh and texture each rig wears with a slot empty, so the rig
  converter no longer guesses that from texture names. Don't go back to
  guessing: the guesses were wrong for the mystics' legs and boots and
  could not find the Kamael's gloves at all. `convert-npcstring.ts` reads the string table
  npc dialogue is written against -- the server sends
  `<fstring>1001004</fstring>` and expects the client to draw "Oren" -- and
  is the one place `DatReader.fstring` matters: those strings are Unreal
  FStrings whose compact-index length carries the *encoding* in its sign
  (negative = UTF-16, and it counts characters, not bytes). The table mixes
  both freely, so assuming either one drifts a byte and then reads garbage.
  `chargrp.ts` reads the
  appearance table the same way, and reads all of it: hair styles, faces, the
  body each empty equipment slot wears, effects and sounds. Both readers hold
  the same line -- the parse must consume the table exactly, ending on its
  `SafePackage` marker -- so a schema change that "mostly works" fails loudly
  instead of returning plausible nonsense. Field names follow the structure
  definitions in L2ClientDat
  (https://github.com/MobiusDevelopment/l2clientdat), a useful reference for
  adding another table; it is GPL and this repo is MIT, so nothing is copied
  from it.

## Commands

Root-level shortcuts (see package.json):

- `pnpm dev:ui` / `pnpm build:ui` — run/build only the UI package
- `pnpm dev:network` / `pnpm build:network` — same for the network package
- `pnpm dev:assets-server` / `pnpm build:assets-server` /
  `pnpm start:assets-server` — same for the assets server
- `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm clean` — turbo, runs across
  all packages

Inside `packages/ui`, `build` runs `tsc --noEmit && vite build` — always
treat a failing typecheck as a build failure, not just a lint nit.

## UI package architecture (`packages/ui/src`)

- `stores/` — MobX. `RootStore` composes `SessionStore`, `UiStore`,
  `GameStore`, `WindowManagerStore`. Access via hooks in `StoreContext.tsx`
  (`useStore`, `useGameStore`, `useWindowManagerStore`, ...). `GameStore`
  currently holds character/inventory/hotbar demo data — this is where
  server-driven state will eventually land.
- `components/screens/` — top-level routed views (login, character-select,
  create-char, game), gated by `UiStore.screen` and synced to `location.hash`.
- `components/menus/` — screen-specific menu panels (login form, char-select
  actions, game cog menu, ...). Absolutely positioned within their screen.
- `components/windows/core/` — the generic window system:
  - `windows.registry.ts` is the single source of truth for every window's
    config (`type`, `origin` corner, default position, draggable/closable,
    etc). Add a new window by adding an entry here, not by hand-rolling
    positioning logic in a component.
  - `window.component.tsx` renders any window purely from its registry
    config + `WindowManagerStore` runtime state (position/open/zIndex).
    Positions are persisted **relative to the window's origin corner** (not
    always top-left) so windows anchored to a screen edge (chat, hotbar,
    game-menu) track that edge natively via CSS `right`/`bottom`, surviving
    viewport resizes (including F11 fullscreen) without JS remeasurement.
  - `slot.component.tsx` / `core/icon-frame.component.tsx` — the
    hotbar/inventory icon slot system. `IconFrame` renders a gradient
    background by type, or a real image via `iconUrl` (falls back to the
    gradient automatically if the image 404s/fails to load).
- `components/core/scene/` — the 3D bodies. `CharacterBody` picks between the
  converted retail model (`GltfCharacterModel`, loaded from
  `VITE_CHARACTER_MODEL_BASE_URL` via `config/character-models.ts`) and the
  procedural `CharacterModel` capsule. The capsule is a first-class fallback,
  not an error state: orcs, Kamael, mobs and summons have no model, and no
  model server is configured by default -- so never make the glTF path
  mandatory, and keep both branches working.
- `config/z-index.ts` — stacking order is **modals > windows > menus >
  screens**. Don't invent new z-index values elsewhere.
- `config/icon-urls.ts` — builds real icon image URLs from `VITE_*_ICON_BASE_URL`
  env vars, substituting a literal `{id}` placeholder in the URL template.

## Conventions

- Component files: `*.component.tsx` for generic/reusable pieces,
  `*.screen.tsx` / `*.menu.tsx` / `*.window.tsx` for the screen/menu/window
  layers.
- Env vars are Vite-style (`VITE_*` prefix, see `.env.example` and
  `vite-env.d.ts`), and get baked into the client bundle at build time —
  don't put anything secret in a `VITE_*` var, it ends up in the public JS.
  Adding one means touching four places, not three: `vite-env.d.ts` (typed +
  documented), `.env.example`, wherever it's read, and — the one that isn't in
  this repository — the gitignored `packages/ui/.env.production` on the host
  that builds the deploy. The build happens there rather than in CI precisely
  because `VITE_*` is baked in at build time, so that file is the only place
  the deployment's real URLs exist; nothing in this repo names a real host or
  domain, and the deploy docs use `example.com`/`myhost` placeholders. A var
  missing from it isn't a build error — the feature just silently falls back
  on the deployed site, which is how the game-menu icons once shipped
  art-less. `VITE_DATAPACK_BASE_URL` is the one whose absence is loud rather
  than subtle: every name in the UI degrades to a raw id. The vars that
  deliberately never go there are `VITE_DEV_LOGIN_USERNAME`/
  `VITE_DEV_LOGIN_PASSWORD` and `VITE_IS_DEMO_MODE`; if a new one belongs in
  that category, say so in a comment rather than just leaving it out.
- No test suite yet. Verification is: `pnpm --filter @lineage2js/ui build`
  (typecheck + build) plus manual visual testing — run the Vite dev server
  and drive it with a real browser (Playwright is a reasonable way to script
  this) before calling a UI change done.
- Don't fetch or commit real Lineage 2 / NCsoft copyrighted art assets into
  this repo, even generated placeholders standing in for them should not be
  sourced from reposted copyrighted material.
