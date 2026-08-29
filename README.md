# lineage2js-ui

Monorepo for Lineage 2 JS network protocol library and web UI client.

## This project is a work in progress

This project is a work in progress so expect bugs, missing features, and incomplete implementations.
The network protocol implementation is still incomplete, and the UI client is in early development. Contributions are welcome!

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the setup, workflow and pull
request requirements. One rule is worth repeating here, because it applies
before you write any code: **no Lineage 2 / NCsoft art or client data belongs
in this repository.** Icons, geodata, character models, textures and the
client's own `.dat` tables all stay out of git — the tooling below builds them
from a copy of the game you already own, into a folder that is gitignored.

## Already implemented features
- Login, re-login and real game server connection
- Character selection and creation with the client's own converted 3d bodies -- textured, with the face, hair style and hair colour the game offers -- and real data from the server
- The player standing in the world on real geodata, with click-to-move sent to the server and the walk checked against the geodata first, so a blocked path is never asked for
- Character bodies animated from the client's own sequences -- idle, walking, running, sitting, picking an item up, dying -- for every nearby player and NPC, not just your own
- Detailed character info window with stats - real info from server, not demo data
- Draggable windows system like in the original game client
- Char info window (Lvl, Nickname, CP/HP/MP/VP) - draggable
- Active effects window (buffs/debuffs) - draggable
- Party members window (Nicknames, Role/Leader icons, CP/HP/MP stats) - draggable
- Selected target window with real info - draggable, click on character/mob/party member to target them
- System message log, and the confirm dialogs the server drives: party invite, trade, duel and couple actions
- Inventory window - WIP, draggable, only display, no equip slots yet
- Hotbar - WIP, only display
- Skill list window - WIP, only display
- Learn skill window - WIP
- Actions window - clickable actions, WIP
- Chat - contains demo text, network/commands/tabs are WIP
- Radar - a debug readout of position, geodata sector/chunk/block and ping, standing in for the real minimap

## Roadmap
- Flesh out the in-game windows — hotbar shortcuts and cooldowns, inventory equip slots, a bottom menu
- Dress the bodies — equipped armour and weapons are parsed and the client's own item→art table is converted, but nothing renders them yet
- Give mobs and NPCs their own models — every converted body is humanoid, so wolves still fall back to a placeholder capsule
- Core gameplay systems — combat, chat, quests, NPC dialog

Real landscape and buildings rendering, minimap, global map and location maps are planned for future updates.

The item-by-item breakdown lives in [TODO.md](./TODO.md). Known bugs/issues are tracked in [KNOWN-BUGS.md](./KNOWN-BUGS.md).

## Packages

- [`packages/network`](./packages/network) — `@lineage2js/network`: login/game protocol implementation (packets, encryption, sockets).
- [`packages/ui`](./packages/ui) — `@lineage2js/ui`: web UI client built on top of `@lineage2js/network`.
- [`packages/assets-server`](./packages/assets-server) — `@lineage2js/assets-server`: Express static server for everything the client needs but the repo must not hold — icons, pre-baked geodata tiles, character models and their textures. Keeps that art out of this repo (`assets/` is gitignored except folder structure) while making it available to the client with `Cache-Control` + `ETag` revalidation. Its `scripts/` are the offline converters that produce those files; see [Serving game assets](#serving-game-assets).

## Tooling

- Package manager: [pnpm](https://pnpm.io) workspaces
- Task runner: [Turborepo](https://turbo.build/repo)

## Getting started

Node.js >= 22 and pnpm >= 9.15.0 (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

```bash
pnpm install
pnpm build
pnpm dev
```

The UI runs without any of the asset pipelines below: missing icons fall back
to coloured gradients, missing bodies to a placeholder capsule, and missing
geodata to a flat grid. Nothing is a hard dependency.

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

Asset pipelines run per package, and each one reads from a source you supply
locally (see below):

| Script                                                        | What it does                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm --filter @lineage2js/assets-server extract:icons`          | Pull skill/item/action icon art out of an installed client               |
| `pnpm --filter @lineage2js/assets-server convert:client-rigs`    | Build the sixteen playable bodies as `.glb`, plus textures, from an installed client |
| `pnpm --filter @lineage2js/assets-server convert:armorgrp`       | Decode the client's armour table (which art dresses which body)          |
| `pnpm --filter @lineage2js/assets-server convert:chargrp`        | Decode the client's appearance table (hair styles, faces)                |
| `pnpm --filter @lineage2js/assets-server convert:geodata`        | Bake L2J `.l2j` region files into streaming geodata tiles                |
| `pnpm --filter @lineage2js/ui convert:items`                     | Convert an item stat CSV into the JSON the tooltips read                 |

## Serving game assets

`packages/assets-server` serves everything under
`packages/assets-server/assets/highfive/` — icons, `geodata-tiles/`,
`models/`, `textures/` and the decoded client tables in `data/` — without any
of it ever being committed. That whole tree is gitignored except for its
folder structure and `.gitkeep` files; see the nested `.gitignore` there for
exactly what's excluded.

```bash
cp .env.example .env   # inside packages/assets-server
pnpm dev:assets-server
```

Point the UI package's `VITE_*_BASE_URL` env vars (see
`packages/ui/.env.example`) at wherever this server ends up running --
locally, or on whatever host serves it in production. Every response is
sent with `Cache-Control: public, max-age=<N>, must-revalidate` plus an
`ETag`; browsers trust their cached copy for `max-age` seconds, then send
a conditional request the server answers with a cheap `304` if the file
is unchanged, or a fresh `200` if it isn't -- no manual cache-busting or
URL versioning required when an asset changes, just overwrite the file.

### Where the assets come from

None of it is downloaded, and none of it is redistributed. Each pipeline
reads a source you already have and writes into the gitignored tree:

- **Icons, character bodies, textures and the `.dat` tables** come from an
  installed Lineage 2 client. The client keeps them in encrypted Unreal
  packages, so the converters shell out to [UE Viewer](https://www.gildor.org)
  (umodel) for the unpacking and do the routing, rigging and naming
  themselves. Point them at the client (and umodel) with `--client=` /
  `--umodel=`, or the `L2_CLIENT_DIR` / `UMODEL` env vars.
- **Geodata tiles** are baked from [L2J `.l2j` region
  files](https://bitbucket.org/l2jgeo/l2j_geodata) dropped into
  `assets/highfive/geodata/`, so the client never has to decode a 6-8MB
  region itself.

Every converter's own header comment documents its flags and output layout;
start there rather than guessing.
