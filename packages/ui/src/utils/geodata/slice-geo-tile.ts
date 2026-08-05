import type { GeoTile } from "./geo-tile.types";
import { GEO_TILE_CELLS } from "../../config/geodata";

/**
 * Cuts a GEO_TILE_CELLS x GEO_TILE_CELLS tile out of a decoded region (or
 * any larger GeoTile), given the tile's cell offset within it -- rows are
 * contiguous in GeoTile's row-major layout, so heights/nswe/layerCounts each
 * copy in one slice per row. The CSR layer fields can't be sliced the same
 * way: source.layerOffsets points into the *whole source's* flattened
 * layerHeights/layerNswe, so the tile needs its own fresh CSR built from the
 * copied layerCounts, with the actual layer values copied cell by cell into
 * their new positions.
 */
export function sliceGeoTile(source: GeoTile, cellOffsetX: number, cellOffsetY: number): GeoTile {
  const tileCellCount = GEO_TILE_CELLS * GEO_TILE_CELLS;
  const heights = new Int16Array(tileCellCount);
  const nswe = new Uint8Array(tileCellCount);
  const layerCounts = new Uint8Array(tileCellCount);

  for (let localY = 0; localY < GEO_TILE_CELLS; localY++) {
    const sourceRowStart = (cellOffsetY + localY) * source.cellsX + cellOffsetX;
    const destRowStart = localY * GEO_TILE_CELLS;
    heights.set(source.heights.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
    nswe.set(source.nswe.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
    layerCounts.set(source.layerCounts.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
  }

  const layerOffsets = new Uint32Array(tileCellCount + 1);
  let totalLayers = 0;
  for (let i = 0; i < tileCellCount; i++) {
    layerOffsets[i] = totalLayers;
    totalLayers += layerCounts[i];
  }
  layerOffsets[tileCellCount] = totalLayers;

  const layerHeights = new Int16Array(totalLayers);
  const layerNswe = new Uint8Array(totalLayers);

  for (let localY = 0; localY < GEO_TILE_CELLS; localY++) {
    for (let localX = 0; localX < GEO_TILE_CELLS; localX++) {
      const destIndex = localY * GEO_TILE_CELLS + localX;
      const sourceIndex = (cellOffsetY + localY) * source.cellsX + (cellOffsetX + localX);

      const sourceStart = source.layerOffsets[sourceIndex];
      const destStart = layerOffsets[destIndex];
      const count = layerCounts[destIndex];

      for (let layer = 0; layer < count; layer++) {
        layerHeights[destStart + layer] = source.layerHeights[sourceStart + layer];
        layerNswe[destStart + layer] = source.layerNswe[sourceStart + layer];
      }
    }
  }

  return { cellsX: GEO_TILE_CELLS, cellsY: GEO_TILE_CELLS, heights, nswe, layerCounts, layerOffsets, layerHeights, layerNswe };
}
