// Geodata layout constants + URL builder. Cell/block/region sizes are the
// real L2J geodata constants (cross-checked against lineage2ts's own
// GeoRegion.ts/PolygonSize.ts -- WorldCellShift=4 -> 16 units/cell,
// WorldPolygonShift=7 -> 128 units/block, PolygonsInSection=256 blocks/region
// side), not something invented for this client. The frontend still streams
// terrain in its own smaller "tile" unit (see world-to-tile.ts/use-geo-tiles.ts)
// -- raw .l2j region files are fetched and sliced into these tiles in memory
// (see l2j-region-parser.ts/slice-geo-tile.ts), not re-encoded on disk.

/** World units covered by one geo-cell (matches the original L2 geodata cell size). */
export const GEO_CELL_SIZE = 16;

/** Geo-cells per tile side -- the frontend's own streaming/rendering granularity. */
export const GEO_TILE_CELLS = 64;

/** World units covered by one tile side. */
export const GEO_TILE_SIZE = GEO_CELL_SIZE * GEO_TILE_CELLS;

/** Geo-cells per block side (a raw .l2j block is an 8x8 cell polygon). */
export const GEO_BLOCK_CELLS = 8;

/** Blocks per region side (a raw .l2j file covers one full region). */
export const GEO_REGION_BLOCKS = 256;

/** Geo-cells per region side. */
export const GEO_REGION_CELLS = GEO_BLOCK_CELLS * GEO_REGION_BLOCKS;

/** World units covered by one region side. */
export const GEO_REGION_SIZE = GEO_CELL_SIZE * GEO_REGION_CELLS;

const GEODATA_REGION_BASE_URL = import.meta.env.VITE_GEODATA_REGION_BASE_URL;

/** URL for the raw .l2j region file at the given region coordinates (see worldToRegionCoords). */
export function getGeodataRegionUrl(regionX: number, regionY: number): string | undefined {
  if (!GEODATA_REGION_BASE_URL) {
    return undefined;
  }
  return GEODATA_REGION_BASE_URL.replace("{regionX}", String(regionX)).replace("{regionY}", String(regionY));
}
