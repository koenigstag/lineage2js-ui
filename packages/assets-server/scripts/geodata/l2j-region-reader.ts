/**
 * Reads a raw L2J geodata region file (https://bitbucket.org/l2jgeo/l2j_geodata,
 * one file per world region) into the same CSR shape as the client's own
 * GeoTile (packages/ui/src/utils/geodata/geo-tile.types.ts). This is a
 * direct port of packages/ui/src/utils/geodata/l2j-region-parser.ts's
 * parseL2jRegion/countLayersPerCell -- same algorithm, already verified
 * against real production .l2j files -- duplicated here because
 * assets-server has no workspace dependency on packages/ui to import it
 * from. Keep both in sync if the block/cell decode ever changes.
 */

/** Geo-cells per block side (a raw .l2j block is an 8x8 cell polygon). Mirrors packages/ui/src/config/geodata.ts's GEO_BLOCK_CELLS. */
export const GEO_BLOCK_CELLS = 8;
/** Blocks per region side (a raw .l2j file covers one full region). Mirrors GEO_REGION_BLOCKS. */
export const GEO_REGION_BLOCKS = 256;
/** Geo-cells per region side. Mirrors GEO_REGION_CELLS. */
export const GEO_REGION_CELLS = GEO_BLOCK_CELLS * GEO_REGION_BLOCKS;

const enum GeoBlockType {
  Flat = 0,
  MultiHeight = 1,
  MultiLayer = 2,
}

/** Raw .l2j cell value's sentinel for "no data" -- a hole in the geometry. */
const LOWEST_HEIGHT = -32768;

function extractHeight(value: number): number {
  if (value === LOWEST_HEIGHT) {
    return LOWEST_HEIGHT;
  }
  // Low 4 bits are the NSWE mask; clearing them and arithmetic-shifting right
  // by 1 recovers the signed height. Must mask with ~0xf (32-bit, preserves
  // sign-extension), not 0xfff0 -- the latter would zero out bits 16-31 too
  // and corrupt every negative height into a huge positive one.
  return (value & ~0xf) >> 1;
}

function extractNswe(value: number): number {
  if (value === LOWEST_HEIGHT) {
    return 0; // fully blocked -- nothing to stand on.
  }
  return value & 0xf;
}

export interface DecodedRegion {
  cellsX: number;
  cellsY: number;
  /** Height per cell (top/highest layer), row-major: index = y * cellsX + x. */
  heights: Int16Array;
  /** NSWE passability per cell, same indexing as heights (top layer). */
  nswe: Uint8Array;
  /** Layers per cell (>=1), row-major, same indexing as heights. */
  layerCounts: Uint8Array;
  /** CSR row-pointer into layerHeights/layerNswe, length cellsX*cellsY + 1. */
  layerOffsets: Uint32Array;
  /** Height per layer, bottom to top, flattened across every cell. */
  layerHeights: Int16Array;
  /** NSWE per layer, same order/length as layerHeights. */
  layerNswe: Uint8Array;
}

/**
 * Pass 1 of 2: walks every block just far enough to know each cell's layer
 * count -- no value decoding here. Sizes the CSR layer arrays before pass 2
 * fills them, so pass 2 can write straight into final position instead of
 * building a per-cell array first.
 */
function countLayersPerCell(view: DataView, layerCounts: Uint8Array): void {
  let offset = 0;

  for (let blockX = 0; blockX < GEO_REGION_BLOCKS; blockX++) {
    for (let blockY = 0; blockY < GEO_REGION_BLOCKS; blockY++) {
      const type = view.getInt8(offset);
      offset += 1;

      const baseCellX = blockX * GEO_BLOCK_CELLS;
      const baseCellY = blockY * GEO_BLOCK_CELLS;

      if (type === GeoBlockType.Flat) {
        offset += 2;
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            layerCounts[(baseCellY + localY) * GEO_REGION_CELLS + (baseCellX + localX)] = 1;
          }
        }
        continue;
      }

      if (type === GeoBlockType.MultiHeight) {
        offset += GEO_BLOCK_CELLS * GEO_BLOCK_CELLS * 2;
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            layerCounts[(baseCellY + localY) * GEO_REGION_CELLS + (baseCellX + localX)] = 1;
          }
        }
        continue;
      }

      if (type === GeoBlockType.MultiLayer) {
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            const layerCount = view.getInt8(offset);
            offset += 1 + layerCount * 2;
            layerCounts[(baseCellY + localY) * GEO_REGION_CELLS + (baseCellX + localX)] = layerCount;
          }
        }
        continue;
      }

      throw new Error(`Unknown L2J geo block type: ${type} at byte offset ${offset - 1}`);
    }
  }
}

/**
 * Decodes a raw L2J geodata region file into a DecodedRegion spanning the
 * whole region (GEO_REGION_CELLS x GEO_REGION_CELLS). MultiLayer blocks
 * (bridges/tunnels) write every layer into layerHeights/layerNswe; heights/
 * nswe get the single highest layer (fast "top layer" path).
 */
export function readL2jRegion(buffer: Buffer): DecodedRegion {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const cellCount = GEO_REGION_CELLS * GEO_REGION_CELLS;

  const layerCounts = new Uint8Array(cellCount);
  countLayersPerCell(view, layerCounts);

  const layerOffsets = new Uint32Array(cellCount + 1);
  let totalLayers = 0;
  for (let i = 0; i < cellCount; i++) {
    layerOffsets[i] = totalLayers;
    totalLayers += layerCounts[i];
  }
  layerOffsets[cellCount] = totalLayers;

  const heights = new Int16Array(cellCount);
  const nswe = new Uint8Array(cellCount);
  const layerHeights = new Int16Array(totalLayers);
  const layerNswe = new Uint8Array(totalLayers);

  function writeSingleLayerCell(cellX: number, cellY: number, value: number): void {
    const index = cellY * GEO_REGION_CELLS + cellX;
    const height = extractHeight(value);
    const nsweValue = extractNswe(value);
    heights[index] = height;
    nswe[index] = nsweValue;
    const start = layerOffsets[index];
    layerHeights[start] = height;
    layerNswe[start] = nsweValue;
  }

  let offset = 0;
  for (let blockX = 0; blockX < GEO_REGION_BLOCKS; blockX++) {
    for (let blockY = 0; blockY < GEO_REGION_BLOCKS; blockY++) {
      const type = view.getInt8(offset);
      offset += 1;

      const baseCellX = blockX * GEO_BLOCK_CELLS;
      const baseCellY = blockY * GEO_BLOCK_CELLS;

      if (type === GeoBlockType.Flat) {
        const value = view.getInt16(offset, true);
        offset += 2;
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            writeSingleLayerCell(baseCellX + localX, baseCellY + localY, value);
          }
        }
        continue;
      }

      if (type === GeoBlockType.MultiHeight) {
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            const value = view.getInt16(offset, true);
            offset += 2;
            writeSingleLayerCell(baseCellX + localX, baseCellY + localY, value);
          }
        }
        continue;
      }

      if (type === GeoBlockType.MultiLayer) {
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            const index = (baseCellY + localY) * GEO_REGION_CELLS + (baseCellX + localX);
            const layerCount = view.getInt8(offset);
            offset += 1;

            const start = layerOffsets[index];
            let bestHeight = -Infinity;
            let bestNswe = 0;
            for (let layer = 0; layer < layerCount; layer++) {
              const value = view.getInt16(offset, true);
              offset += 2;
              const height = extractHeight(value);
              const nsweValue = extractNswe(value);
              layerHeights[start + layer] = height;
              layerNswe[start + layer] = nsweValue;
              if (height > bestHeight) {
                bestHeight = height;
                bestNswe = nsweValue;
              }
            }

            heights[index] = bestHeight === -Infinity ? LOWEST_HEIGHT : bestHeight;
            nswe[index] = bestNswe;
          }
        }
        continue;
      }

      throw new Error(`Unknown L2J geo block type: ${type} at byte offset ${offset - 1}`);
    }
  }

  return { cellsX: GEO_REGION_CELLS, cellsY: GEO_REGION_CELLS, heights, nswe, layerCounts, layerOffsets, layerHeights, layerNswe };
}
