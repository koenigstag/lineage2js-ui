import type { GeoTile } from "./geo-tile.types";
import { GEO_TILE_CELLS } from "../../config/geodata";

/**
 * Cuts a GEO_TILE_CELLS x GEO_TILE_CELLS tile out of a decoded region (or
 * any larger GeoTile), given the tile's cell offset within it -- rows are
 * contiguous in GeoTile's row-major layout, so each row copies in one slice.
 */
export function sliceGeoTile(source: GeoTile, cellOffsetX: number, cellOffsetY: number): GeoTile {
  const heights = new Int16Array(GEO_TILE_CELLS * GEO_TILE_CELLS);
  const nswe = new Uint8Array(GEO_TILE_CELLS * GEO_TILE_CELLS);

  for (let localY = 0; localY < GEO_TILE_CELLS; localY++) {
    const sourceRowStart = (cellOffsetY + localY) * source.cellsX + cellOffsetX;
    const destRowStart = localY * GEO_TILE_CELLS;
    heights.set(source.heights.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
    nswe.set(source.nswe.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
  }

  return { cellsX: GEO_TILE_CELLS, cellsY: GEO_TILE_CELLS, heights, nswe };
}
