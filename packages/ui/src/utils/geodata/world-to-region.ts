import { GEO_REGION_SIZE } from "../../config/geodata";

/** Region coordinates (regionX, regionY) containing the given L2 world (x, y) position -- one raw .l2j file per region. */
export function worldToRegionCoords(worldX: number, worldY: number): [regionX: number, regionY: number] {
  return [Math.floor(worldX / GEO_REGION_SIZE), Math.floor(worldY / GEO_REGION_SIZE)];
}

export function regionKey(regionX: number, regionY: number): string {
  return `${regionX}_${regionY}`;
}
