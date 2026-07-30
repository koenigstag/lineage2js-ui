import { GEO_TILE_SIZE } from "../../config/geodata";

/** Tile coordinates (tileX, tileY) containing the given L2 world (x, y) position. */
export function worldToTileCoords(worldX: number, worldY: number): [tileX: number, tileY: number] {
  return [Math.floor(worldX / GEO_TILE_SIZE), Math.floor(worldY / GEO_TILE_SIZE)];
}

export function tileKey(tileX: number, tileY: number): string {
  return `${tileX}_${tileY}`;
}
