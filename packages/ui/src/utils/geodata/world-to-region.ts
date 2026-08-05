import { GEO_REGION_SIZE, GEO_REGION_ZERO_TILE_X, GEO_REGION_ZERO_TILE_Y } from "../../config/geodata";

/**
 * Region coordinates (regionX, regionY) containing the given L2 world (x, y)
 * position -- one raw .l2j file per region, named with these same raw
 * map-tile numbers (see GEO_REGION_ZERO_TILE_X/Y).
 */
export function worldToRegionCoords(worldX: number, worldY: number): [regionX: number, regionY: number] {
  return [
    Math.floor(worldX / GEO_REGION_SIZE) + GEO_REGION_ZERO_TILE_X,
    Math.floor(worldY / GEO_REGION_SIZE) + GEO_REGION_ZERO_TILE_Y,
  ];
}

export function regionKey(regionX: number, regionY: number): string {
  return `${regionX}_${regionY}`;
}
