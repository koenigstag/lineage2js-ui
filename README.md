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

Everything below runs on real server data. The demo placeholders are behind
`VITE_IS_DEMO_MODE` and off by default.

**Getting in**
- Login, re-login and real game server connection, with server select and remembered accounts
- Character select, including deletion with the server's own deferred timer and restore before it runs out
- Character creation on the client's own converted 3d bodies -- textured, with the face, hair style and hair colour the game offers -- and real templates from the server

**In the world**
- The player standing on real geodata, streamed as tiles around them
- Click-to-move sent to the server, with the straight path checked against the geodata first so a blocked walk is never asked for
- Every nearby player and NPC drawn as the client's own rig, animated from the client's own sequences: idle, walking and running, sitting and standing up, picking an item up, dying, casting for as long as the server says the cast takes, and attacking with the swing that matches the weapon in hand
- Dropped items on the ground, and picking them up
- Targeting by clicking a creature or cycling to the next one, then attacking or talking -- both walk into range first

**Windows** — all draggable, and they remember where you put them relative to the screen edge they hang off
- Character window with real stats
- Char info (Lvl, Nickname, CP/HP/MP/VP)
- Active effects (buffs/debuffs), and the target's own effect row
- Party members (nicknames, role/leader icons, CP/HP/MP), with invite, leave, dismiss and leadership transfer
- Selected target with real info
- Inventory with equip slots -- equip, unequip and use items, item tooltips with real stats, weight bar
- Hotbar -- keyboard-activated, casts skills, uses items and runs actions; drag them in from the skills, inventory and actions windows, and toggle soulshot auto-use
- Skills list with Active/Passive/Learn tabs, and learning a skill for SP
- Actions window -- real requests, with the server's own allowed-action list respected
- System message log
- Chat with channel tabs, sending and receiving
- Settings -- UI language (English and Russian)
- Radar -- a debug readout of position, geodata sector/chunk/block and ping, standing in for the real minimap
- Server-driven prompts: party invite, trade, duel, couple actions, resurrect, and the death screen

Quests, clan, macros and the map open as empty frames -- the window is there,
the feature behind it is not.

## Roadmap
- Fill in the empty frames — quests, clan, macros, and a real map behind the radar
- A bottom menu — adena, weight, XP bar, unread messages, party and clan entries
- Dress the bodies — equipment is parsed and the client's own item-to-art table is converted, but no armour or weapon is rendered on anyone yet
- Give mobs and NPCs their own models — every converted body is humanoid, so a wolf still falls back to a placeholder capsule
- Keyboard movement — WASD still drives only the offline test character, never the server; clicking does
- NPC dialog, quests, and per-id item/skill descriptions

Real landscape and buildings rendering, a global map and location maps are planned for future updates.

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
