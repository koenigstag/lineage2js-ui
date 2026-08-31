const DATAPACK_BASE_URL = import.meta.env.VITE_DATAPACK_BASE_URL;

/**
 * URL of one datapack table on the assets server, or undefined when no assets
 * server is configured.
 *
 * These are the reference tables that turn ids into words -- item and npc
 * names, skill descriptions, system messages, the stat tables the tooltips
 * read. They used to ship inside the bundle out of `public/`, and moved to the
 * assets server so third-party reference data stops living in the repository,
 * which is the line the icons, models and converted client tables already sit
 * on.
 *
 * The cost of that move is that an unconfigured client has no names for
 * anything. Every consumer already falls back to the raw id (see
 * DatapackStore, where each loader leaves its table empty on failure), so this
 * is degraded rather than broken -- but names are no longer the zero-config
 * default they were while the tables were bundled, and `pnpm dev:ui` wants
 * `pnpm dev:assets-server` alongside it to show them.
 */
export function datapackUrl(path: string): string | undefined {
  if (!DATAPACK_BASE_URL) {
    return undefined;
  }
  return DATAPACK_BASE_URL.endsWith("/") ? `${DATAPACK_BASE_URL}${path}` : `${DATAPACK_BASE_URL}/${path}`;
}
