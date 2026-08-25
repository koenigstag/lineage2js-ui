import { GEO_TILE_SIZE } from "../../config/geodata";

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
  return [(worldX >> 15) + 20, (worldY >> 15) + 18];
}
