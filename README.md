# lineage2js-ui

Monorepo for Lineage 2 JS network protocol library and web UI client.

## Packages

- [`packages/network`](./packages/network) — `@lineage2js/network`: login/game protocol implementation (packets, encryption, sockets).
- [`packages/ui`](./packages/ui) — `@lineage2js/ui`: web UI client built on top of `@lineage2js/network`.
- [`packages/assets-server`](./packages/assets-server) — `@lineage2js/assets-server`: Express static server for game icons (skills/items/actions/classes). Keeps copyrighted art out of this repo (`assets/` is gitignored except folder structure) while making it available to the client with `Cache-Control` + `ETag` revalidation.

## Tooling

- Package manager: [pnpm](https://pnpm.io) workspaces
- Task runner: [Turborepo](https://turbo.build/repo)

## Getting started

```bash
pnpm install
pnpm build
pnpm dev
```

## Scripts

Root-level scripts operate across every package via Turborepo:

| Script          | What it does                          |
| ---------------- | -------------------------------------- |
| `pnpm build`      | Build every package                    |
| `pnpm dev`        | Run every package's dev/watch task     |
| `pnpm lint`       | Lint every package                     |
| `pnpm test`       | Run every package's tests              |
| `pnpm clean`      | Remove every package's build output    |

Shortcuts for working on a single package without `--filter`:

| Script                  | What it does                                              |
| ------------------------ | ----------------------------------------------------------- |
| `pnpm dev:ui`             | Start the UI package's Vite dev server                     |
| `pnpm build:ui`           | Typecheck + build the UI package                            |
| `pnpm build:ui:pages`     | Build the UI package with the GitHub Pages base path        |
| `pnpm dev:network`        | Watch-build the network package                             |
| `pnpm build:network`      | Build the network package                                   |
| `pnpm dev:assets-server`  | Run the assets server with hot reload                        |
| `pnpm build:assets-server`| Build the assets server                                      |
| `pnpm start:assets-server`| Run the built assets server (`dist/index.js`)                |

## Serving game icons

`packages/assets-server` serves skill/item/action/class icons from
`packages/assets-server/assets/highfive/icons/{skills,items,actions,classes}/`
without ever committing the actual images (that directory is gitignored
except for its folder structure and `.gitkeep` files — see the nested
`.gitignore` there for exactly what's excluded).

```bash
# drop real PNGs into assets/highfive/icons/<kind>/<id>.png, then:
cp .env.example .env   # inside packages/assets-server
pnpm dev:assets-server
```

Point the UI package's `VITE_*_ICON_BASE_URL` env vars (see
`packages/ui/.env.example`) at wherever this server ends up running --
locally, or on whatever host serves it in production. Every response is
sent with `Cache-Control: public, max-age=<N>, must-revalidate` plus an
`ETag`; browsers trust their cached copy for `max-age` seconds, then send
a conditional request the server answers with a cheap `304` if the file
is unchanged, or a fresh `200` if it isn't -- no manual cache-busting or
URL versioning required when an icon changes, just overwrite the file.
