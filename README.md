# lineage2js-ui

Monorepo for Lineage 2 JS network protocol library and web UI client.

## Packages

- [`packages/network`](./packages/network) — `@lineage2js/network`: login/game protocol implementation (packets, encryption, sockets).
- [`packages/ui`](./packages/ui) — `@lineage2js/ui`: web UI client built on top of `@lineage2js/network`.

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
