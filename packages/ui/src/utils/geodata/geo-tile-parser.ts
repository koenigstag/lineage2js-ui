import type { GeoTile } from "./geo-tile.types";

/**
 * Binary layout (little-endian), matches
 * packages/assets-server/scripts/geodata/tile-format.ts:
 *   uint16 cellsX
 *   uint16 cellsY
 *   int16  heights[cellCount]        -- fast path, top layer, row-major
 *   uint8  nswe[cellCount]           -- fast path, top layer
 *   uint8  layerCounts[cellCount]
 *   int16  layerHeights[totalLayers] -- bottom to top, cell-major
 *   uint8  layerNswe[totalLayers]
 *
 * layerOffsets isn't stored on disk -- rebuilt here via prefix-sum over
 * layerCounts, same as the (pre-baking) region decode already does.
 */
export function parseGeoTile(buffer: ArrayBuffer): GeoTile {
  const view = new DataView(buffer);
  const cellsX = view.getUint16(0, true);
  const cellsY = view.getUint16(2, true);
  const cellCount = cellsX * cellsY;

  let offset = 4;

  const heights = new Int16Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    heights[i] = view.getInt16(offset + i * 2, true);
  }
  offset += cellCount * 2;

  const nswe = new Uint8Array(buffer, offset, cellCount);
  offset += cellCount;

  const layerCounts = new Uint8Array(buffer, offset, cellCount);
  offset += cellCount;

  const layerOffsets = new Uint32Array(cellCount + 1);
  let totalLayers = 0;
  for (let i = 0; i < cellCount; i++) {
    layerOffsets[i] = totalLayers;
    totalLayers += layerCounts[i];
  }
  layerOffsets[cellCount] = totalLayers;

  const layerHeights = new Int16Array(totalLayers);
  for (let i = 0; i < totalLayers; i++) {
    layerHeights[i] = view.getInt16(offset + i * 2, true);
  }
  offset += totalLayers * 2;

  const layerNswe = new Uint8Array(buffer, offset, totalLayers);

  return { cellsX, cellsY, heights, nswe, layerCounts, layerOffsets, layerHeights, layerNswe };
}
