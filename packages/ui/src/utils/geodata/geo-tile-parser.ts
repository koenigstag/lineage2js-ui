import type { GeoTile } from "./geo-tile.types";

/**
 * Binary layout (little-endian), matches
 * packages/assets-server/scripts/generate-geodata.ts:
 *   uint16 cellsX
 *   uint16 cellsY
 *   int16  heights[cellsX * cellsY]
 *   uint8  nswe[cellsX * cellsY]
 */
export function parseGeoTile(buffer: ArrayBuffer): GeoTile {
  const view = new DataView(buffer);
  const cellsX = view.getUint16(0, true);
  const cellsY = view.getUint16(2, true);
  const cellCount = cellsX * cellsY;

  const heightsOffset = 4;
  const nsweOffset = heightsOffset + cellCount * 2;

  const heights = new Int16Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    heights[i] = view.getInt16(heightsOffset + i * 2, true);
  }

  const nswe = new Uint8Array(buffer, nsweOffset, cellCount);

  return { cellsX, cellsY, heights, nswe };
}
