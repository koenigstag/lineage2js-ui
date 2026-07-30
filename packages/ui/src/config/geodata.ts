// Geodata tile layout constants + URL builder. Mirrors the synthetic
// generator in packages/assets-server/scripts/generate-geodata.ts and the
// binary layout parsed in src/utils/geodata/geo-tile-parser.ts -- keep all
// three in sync if the format changes.

/** World units covered by one geo-cell (matches the original L2 geodata cell size). */
export const GEO_CELL_SIZE = 16;

/** Geo-cells per tile side. */
export const GEO_TILE_CELLS = 64;

/** World units covered by one tile side. */
export const GEO_TILE_SIZE = GEO_CELL_SIZE * GEO_TILE_CELLS;

const GEODATA_BASE_URL = import.meta.env.VITE_GEODATA_BASE_URL;

/** URL for the tile at the given tile coordinates (see worldToTileCoords). */
export function getGeodataTileUrl(tileX: number, tileY: number): string | undefined {
  if (!GEODATA_BASE_URL) {
    return undefined;
  }
  return GEODATA_BASE_URL.replace("{tileX}", String(tileX)).replace("{tileY}", String(tileY));
}
