// Geodata layout constants + URL builder. Cell/tile sizes are the real L2J
// geodata constants (cross-checked against lineage2ts's own
// GeoRegion.ts/PolygonSize.ts -- WorldCellShift=4 -> 16 units/cell), not
// something invented for this client. Real .l2j region files are
// pre-sliced into this project's own smaller streaming "tile" unit once,
// offline (see packages/assets-server/scripts/convert-l2j-geodata.ts) --
// the client only ever fetches and deserializes those small pre-baked
// tiles (see utils/geodata/geo-tile-parser.ts), never a whole raw region.

/** World units covered by one geo-cell (matches the original L2 geodata cell size). */
export const GEO_CELL_SIZE = 16;

/** Geo-cells per tile side -- the frontend's own streaming/rendering granularity. */
export const GEO_TILE_CELLS = 64;

/** World units covered by one tile side. */
export const GEO_TILE_SIZE = GEO_CELL_SIZE * GEO_TILE_CELLS;

/** Geo-cells per raw L2J block side (an 8x8 cell polygon -- FLAT/COMPLEX/MULTI, see l2j-region-reader.ts on the assets-server side). */
export const GEO_BLOCK_CELLS = 8;

/** Geo-cells per raw L2J region ("sector") side. */
export const GEO_REGION_CELLS = 2048;

/** World units covered by one region side (matches lineage2ts's L2MapTile.Size). */
export const GEO_REGION_SIZE = GEO_CELL_SIZE * GEO_REGION_CELLS;

// Mirrors world-to-tile.ts's worldToRegionCoords offset (regionX = (x>>15)+20 etc.).
export const GEO_REGION_ZERO_X = 20;
export const GEO_REGION_ZERO_Y = 18;

const GEODATA_TILE_BASE_URL = import.meta.env.VITE_GEODATA_TILE_BASE_URL;

/** URL for the pre-baked tile file at the given tile coordinates (see worldToTileCoords). */
export function getGeodataTileUrl(tileX: number, tileY: number): string | undefined {
  if (!GEODATA_TILE_BASE_URL) {
    return undefined;
  }
  return GEODATA_TILE_BASE_URL.replace("{tileX}", String(tileX)).replace("{tileY}", String(tileY));
}
