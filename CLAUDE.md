# lineage2js-ui

Monorepo for a Lineage 2 fan/emulator web client: a network protocol library
and a React UI client built on top of it. See README.md for the elevator
pitch; this file is for working in the code.

## Structure

- pnpm workspaces + Turborepo. Packages live in `packages/*`.
- `packages/network` (`@lineage2js/network`) — login/game protocol layer
  (packets, encryption, sockets). Plain TypeScript, compiled with `tsc`.
- `packages/ui` (`@lineage2js/ui`) — the web client. Vite + React + TypeScript
  + MobX (`mobx-react-lite`). This is where almost all UI work happens.
- `packages/assets-server` (`@lineage2js/assets-server`) — Express static
  server for game icons (skills/items/actions/classes). Real image files
  live under `assets/highfive/icons/<kind>/<id>.png` and are gitignored
  (only the folder structure + `.gitkeep` are tracked) since that art is
  copyrighted -- don't ever commit real icons here or anywhere else in this
  repo. Serves with `Cache-Control: max-age + must-revalidate` and an ETag
  from file size/mtime, so overwriting a file is enough to invalidate
  clients' caches (no URL versioning needed).

## Commands

Root-level shortcuts (see package.json):

- `pnpm dev:ui` / `pnpm build:ui` — run/build only the UI package
- `pnpm build:ui:pages` — production build with the GitHub Pages base path
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
- No test suite yet. Verification is: `pnpm --filter @lineage2js/ui build`
  (typecheck + build) plus manual visual testing — run the Vite dev server
  and drive it with a real browser (Playwright is a reasonable way to script
  this) before calling a UI change done.
- Don't fetch or commit real Lineage 2 / NCsoft copyrighted art assets into
  this repo, even generated placeholders standing in for them should not be
  sourced from reposted copyrighted material.
