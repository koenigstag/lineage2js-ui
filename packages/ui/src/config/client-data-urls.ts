const CLIENT_DATA_BASE_URL = import.meta.env.VITE_CLIENT_DATA_BASE_URL;

/**
 * URL of one table converted out of the retail client's `system/*.dat` files
 * (assets-server/scripts/convert-npcstring.ts and friends), or undefined
 * when no assets server is configured.
 *
 * Kept apart from the datapack tables next door (config/datapack-urls.ts)
 * even though both are served off the same assets server now: these are
 * lifted straight out of an installed client, the datapack tables came from a
 * third-party database, and the two are converted by different scripts into
 * different folders. Every consumer needs a sane answer for "not configured",
 * exactly like the icon and model URLs do.
 */
export function clientDataUrl(table: string): string | undefined {
  return CLIENT_DATA_BASE_URL ? `${CLIENT_DATA_BASE_URL}${table}` : undefined;
}
