const CLIENT_DATA_BASE_URL = import.meta.env.VITE_CLIENT_DATA_BASE_URL;

/**
 * URL of one table converted out of the retail client's `system/*.dat` files
 * (assets-server/scripts/convert-npcstring.ts and friends), or undefined
 * when no assets server is configured.
 *
 * These live on the assets server rather than in public/ because they are
 * lifted straight out of an installed client, which is the same line the
 * models, textures and icons sit on -- converted locally, gitignored, served
 * separately. Everything in public/ came from a third-party database
 * instead. Every consumer therefore needs a sane answer for "not
 * configured", exactly like the icon and model URLs do.
 */
export function clientDataUrl(table: string): string | undefined {
  return CLIENT_DATA_BASE_URL ? `${CLIENT_DATA_BASE_URL}${table}` : undefined;
}
