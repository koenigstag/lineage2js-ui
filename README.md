# lineage2js-ui

Monorepo for Lineage 2 JS network protocol library and web UI client.

## This project is a work in progress

This project is a work in progress so expect bugs, missing features, and incomplete implementations.
The network protocol implementation is still incomplete, and the UI client is in early development. Contributions are welcome!

## Roadmap
- Add simple mobs radar (red dots), no minimap yet
- Implement basic movement system on fake plain surface
- Add temporary 3D model for all mobs (based on collision radius, no animations yet)
- Add basic combat system (target, attack, skills, HP/MP/CP)
- Add basic chat system

Real landscape and buildings rendering, geodata integration, minimap, global map, location maps, and 3D models rewrite are planned for the future updates.

TODOs are tracked in [TODO.md](./TODO.md). Known bugs/issues are tracked in [KNOWN-BUGS.md](./KNOWN-BUGS.md).

## Packages

- [`packages/network`](./packages/network) — `@lineage2js/network`: login/game protocol implementation (packets, encryption, sockets).
- [`packages/ui`](./packages/ui) — `@lineage2js/ui`: web UI client built on top of `@lineage2js/network`.
- [`packages/assets-server`](./packages/assets-server) — `@lineage2js/assets-server`: Express static server for game icons (skills/items/actions/classes). Keeps copyrighted art out of this repo (`assets/` is gitignored except folder structure) while making it available to the client with `Cache-Control` + `ETag` revalidation.
- [`packages/proxy`](./packages/proxy) — `@lineage2js/proxy`: WebSocket ⇄ TCP bridge for L2 servers that only speak raw TCP. Browsers can't open TCP sockets, so the client's WebSocket traffic gets relayed to the real login/game server (packets stay encrypted end to end — the proxy just moves bytes).

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
| `pnpm dev:proxy`          | Run the WebSocket⇄TCP proxy with hot reload                  |
| `pnpm build:proxy`        | Build the proxy                                              |
| `pnpm start:proxy`        | Run the built proxy (`dist/index.js`)                        |

## Connecting to a TCP-only L2 server

The client speaks the login/game protocol over a WebSocket, because that's
the only socket a browser can open. Servers built for the retail client
(L2J, L2OFF, lineage2ts, ...) listen on raw TCP, so `packages/proxy` has to
sit in front of them:

```bash
pnpm build:proxy
PROXY_ROUTES="2106=server:2106,7777=server:7777" pnpm start:proxy
```

where `server` is the L2 server's host as seen from the proxy — `127.0.0.1`
if they share a machine, a hostname/IP/container name otherwise.

Point `VITE_LOGIN_SERVER_IP` / `VITE_LOGIN_SERVER_PORT` (see
`packages/ui/.env.example`) at the proxy's login port. The game server's
address comes from the login server's own `ServerList` packet, so that entry
has to point at a proxy port too — see
[`packages/proxy/README.md`](./packages/proxy/README.md) for the full layout,
the URL-routed mode, and the origin/allowlist settings you want before
exposing it publicly.

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
