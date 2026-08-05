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

/**
 * Raw L2J map-tile numbers whose region covers world origin (0, 0) -- e.g.
 * region "20_18.l2j" in a real geodata pack (https://bitbucket.org/l2jgeo/l2j_geodata)
 * is the one at world (0, 0), not "0_0.l2j". Matches L2J Mobius's own
 * World.TILE_ZERO_COORD_X/Y. Real geodata packs are always named with these
 * raw tile numbers (11-26 on the retail map), so region coordinates
 * throughout this client (world-to-region.ts, use-geo-tiles.ts) bake this
 * offset in, keeping "regionX/regionY" consistently meaning the same thing
 * a downloaded .l2j file is actually named.
 */
export const GEO_REGION_ZERO_TILE_X = 20;
export const GEO_REGION_ZERO_TILE_Y = 18;

const GEODATA_REGION_BASE_URL = import.meta.env.VITE_GEODATA_REGION_BASE_URL;

/** URL for the raw .l2j region file at the given region coordinates (see worldToRegionCoords). */
export function getGeodataRegionUrl(regionX: number, regionY: number): string | undefined {
  if (!GEODATA_REGION_BASE_URL) {
    return undefined;
  }
  return GEODATA_REGION_BASE_URL.replace("{regionX}", String(regionX)).replace("{regionY}", String(regionY));
}
