import {
  GEO_BLOCK_CELLS,
  GEO_CELL_SIZE,
  GEO_REGION_SIZE,
  GEO_REGION_ZERO_X,
  GEO_REGION_ZERO_Y,
  GEO_TILE_SIZE,
} from "../../config/geodata";

/** Tile coordinates (tileX, tileY) containing the given L2 world (x, y) position. */
export function worldToTileCoords(worldX: number, worldY: number): [tileX: number, tileY: number] {
  return [Math.floor(worldX / GEO_TILE_SIZE), Math.floor(worldY / GEO_TILE_SIZE)];
}

export function tileKey(tileX: number, tileY: number): string {
  return `${tileX}_${tileY}`;
}

/**
 * L2 world region ("sector") coordinates -- the real server's coarse
 * 32768-unit map-file grid (e.g. "20_22" for Dion Castle Town), NOT this
 * project's own finer streaming geodata tile (see worldToTileCoords/
 * GEO_TILE_SIZE, a 1024-unit subdivision within one such sector). Formula
 * cross-checked against lineage2ts's L2MapTile.getGeoRegionCode: regionX =
 * (x >> 15) + 20, regionY = (y >> 15) + 18 (verified by re-deriving Dion's
 * own "20_22" from its real spawn coordinates).
 */
export function worldToRegionCoords(worldX: number, worldY: number): [regionX: number, regionY: number] {
  return [(worldX >> 15) + GEO_REGION_ZERO_X, (worldY >> 15) + GEO_REGION_ZERO_Y];
}

/** World (x, y) of the given region's own local (0, 0) corner. */
function regionOrigin(regionX: number, regionY: number): [originX: number, originY: number] {
  return [(regionX - GEO_REGION_ZERO_X) * GEO_REGION_SIZE, (regionY - GEO_REGION_ZERO_Y) * GEO_REGION_SIZE];
}

/**
 * Region-relative raw L2J block coordinates (0-255 each) containing the
 * given L2 world (x, y) position -- matches how a .l2j geodata editor
 * addresses blocks (one region file at a time), not this project's own
 * global tile numbering.
 */
export function worldToBlockCoords(worldX: number, worldY: number): [blockX: number, blockY: number] {
  const [regionX, regionY] = worldToRegionCoords(worldX, worldY);
  const [originX, originY] = regionOrigin(regionX, regionY);
  const blockSize = GEO_BLOCK_CELLS * GEO_CELL_SIZE;
  return [Math.floor((worldX - originX) / blockSize), Math.floor((worldY - originY) / blockSize)];
}

/** Region-relative raw geo-cell coordinates (0-2047 each) containing the given L2 world (x, y) position. */
export function worldToCellCoords(worldX: number, worldY: number): [cellX: number, cellY: number] {
  const [regionX, regionY] = worldToRegionCoords(worldX, worldY);
  const [originX, originY] = regionOrigin(regionX, regionY);
  return [Math.floor((worldX - originX) / GEO_CELL_SIZE), Math.floor((worldY - originY) / GEO_CELL_SIZE)];
}
