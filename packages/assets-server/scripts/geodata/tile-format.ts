import type { DecodedRegion } from "./l2j-region-reader";

/** Geo-cells per tile side -- the frontend's own streaming/rendering granularity. Mirrors packages/ui/src/config/geodata.ts's GEO_TILE_CELLS. */
export const GEO_TILE_CELLS = 64;

/**
 * Cuts a GEO_TILE_CELLS x GEO_TILE_CELLS window out of a decoded region and
 * serializes it straight to this project's pre-baked tile format, read by
 * packages/ui/src/utils/geodata/geo-tile-parser.ts -- keep both in sync:
 *
 *   uint16 cellsX
 *   uint16 cellsY
 *   int16  heights[cellCount]        -- fast path, top layer, row-major
 *   uint8  nswe[cellCount]           -- fast path, top layer
 *   uint8  layerCounts[cellCount]
 *   int16  layerHeights[totalLayers] -- bottom to top, cell-major
 *   uint8  layerNswe[totalLayers]
 *
 * layerOffsets isn't stored -- the client rebuilds it via prefix-sum over
 * layerCounts, same as the region decode already does.
 */
export function writeGeoTile(region: DecodedRegion, cellOffsetX: number, cellOffsetY: number): Buffer {
  const cellCount = GEO_TILE_CELLS * GEO_TILE_CELLS;

  const heights = new Int16Array(cellCount);
  const nswe = new Uint8Array(cellCount);
  const layerCounts = new Uint8Array(cellCount);

  for (let localY = 0; localY < GEO_TILE_CELLS; localY++) {
    const sourceRowStart = (cellOffsetY + localY) * region.cellsX + cellOffsetX;
    const destRowStart = localY * GEO_TILE_CELLS;
    heights.set(region.heights.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
    nswe.set(region.nswe.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
    layerCounts.set(region.layerCounts.subarray(sourceRowStart, sourceRowStart + GEO_TILE_CELLS), destRowStart);
  }

  let totalLayers = 0;
  for (let i = 0; i < cellCount; i++) {
    totalLayers += layerCounts[i];
  }

  const headerSize = 4;
  const buffer = Buffer.alloc(headerSize + cellCount * 2 + cellCount + cellCount + totalLayers * 2 + totalLayers);

  let offset = 0;
  buffer.writeUInt16LE(GEO_TILE_CELLS, offset);
  offset += 2;
  buffer.writeUInt16LE(GEO_TILE_CELLS, offset);
  offset += 2;

  for (let i = 0; i < cellCount; i++) {
    buffer.writeInt16LE(heights[i], offset);
    offset += 2;
  }
  for (let i = 0; i < cellCount; i++) {
    buffer.writeUInt8(nswe[i], offset);
    offset += 1;
  }
  for (let i = 0; i < cellCount; i++) {
    buffer.writeUInt8(layerCounts[i], offset);
    offset += 1;
  }

  // layerHeights/layerNswe: pull each cell's layers straight from the source
  // region (via its own CSR layerOffsets) rather than building an
  // intermediate per-tile CSR structure first.
  for (let localY = 0; localY < GEO_TILE_CELLS; localY++) {
    for (let localX = 0; localX < GEO_TILE_CELLS; localX++) {
      const destIndex = localY * GEO_TILE_CELLS + localX;
      const sourceIndex = (cellOffsetY + localY) * region.cellsX + (cellOffsetX + localX);
      const sourceStart = region.layerOffsets[sourceIndex];
      const count = layerCounts[destIndex];
      for (let layer = 0; layer < count; layer++) {
        buffer.writeInt16LE(region.layerHeights[sourceStart + layer], offset);
        offset += 2;
      }
    }
  }
  for (let localY = 0; localY < GEO_TILE_CELLS; localY++) {
    for (let localX = 0; localX < GEO_TILE_CELLS; localX++) {
      const destIndex = localY * GEO_TILE_CELLS + localX;
      const sourceIndex = (cellOffsetY + localY) * region.cellsX + (cellOffsetX + localX);
      const sourceStart = region.layerOffsets[sourceIndex];
      const count = layerCounts[destIndex];
      for (let layer = 0; layer < count; layer++) {
        buffer.writeUInt8(region.layerNswe[sourceStart + layer], offset);
        offset += 1;
      }
    }
  }

  return buffer;
}
