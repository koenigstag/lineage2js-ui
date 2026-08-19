# lineage2js-ui

Monorepo for Lineage 2 JS network protocol library and web UI client.

## This project is a work in progress

This project is a work in progress so expect bugs, missing features, and incomplete implementations.
The network protocol implementation is still incomplete, and the UI client is in early development. Contributions are welcome!

## Contributing



## Already implemented features
- Login, re-login and real game server connection
- Character selection and creation with demo 3d models and real data from the server
- Detailed character info window with stats - real info from server, not demo data
- Draggable windows system like in the original game client
- Char info window (Lvl, Nickname, CP/HP/MP/VP) - draggable
- Active effects window (buffs/debuffs) - draggable
- Party members window (Nicknames, Role/Leader icons, CP/HP/MP stats) - draggable
- Selected target window with real info - draggable, click on character/mob/party member to target them
- Inventory window - WIP, draggable, only display, no equip slots yet
- Hotbar - WIP, only display
- Skill list window - WIP, only display
- Learn skill window - WIP
- Actions window - clickable actions, WIP
- Chat - contains demo text, network/commands/tabs are WIP

## Roadmap
- Flesh out the in-game windows — character info, hotbar, inventory equipment
- Put the player in the world — fake surface, send movement to server, show mob radar, use demo 3D models
- Core gameplay systems — movement, combat, chat, quests, party

Real landscape and buildings rendering, geodata integration, minimap, global map, location maps, and 3D models rewrite are planned for the future updates.

The item-by-item breakdown lives in [TODO.md](./TODO.md). Known bugs/issues are tracked in [KNOWN-BUGS.md](./KNOWN-BUGS.md).

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
