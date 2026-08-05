import type { GeoTile } from "./geo-tile.types";
import { GEO_BLOCK_CELLS, GEO_REGION_BLOCKS, GEO_REGION_CELLS } from "../../config/geodata";

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
  // by 1 recovers the signed height (heights are always stored as multiples
  // of 8, so they never collide with the low nibble). Must mask with ~0xf
  // (32-bit, preserves sign-extension), not 0xfff0 -- the latter would zero
  // out bits 16-31 too and corrupt every negative height into a huge
  // positive one. Cross-checked against lineage2ts's own extractHeight
  // (CommonOperations.ts / GeoConverter.ts), both use `value & 0xFFFFFFF0`.
  return (value & ~0xf) >> 1;
}

function extractNswe(value: number): number {
  if (value === LOWEST_HEIGHT) {
    return 0; // fully blocked -- nothing to stand on.
  }
  // Raw L2J's 4-bit direction mask already uses the same "bit set = passable"
  // convention as GeoTile.nswe (0xF = all four directions open), so no remapping needed.
  return value & 0xf;
}

/**
 * Pass 1 of 2: walks every block just far enough to know each cell's layer
 * count (1 for Flat/MultiHeight, the block's own byte for MultiLayer) --
 * no value decoding here. Needed to size/allocate the CSR layer arrays
 * before pass 2 fills them, so pass 2 can write straight into their final
 * position instead of building a per-cell array first (this runs in the
 * browser per region fetched, cellCount is 2048x2048 -- avoiding a temporary
 * allocation per cell matters here).
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
 * Decodes a raw L2J geodata region file (https://bitbucket.org/l2jgeo/l2j_geodata,
 * one file per world region) into a single GeoTile spanning the whole
 * region (GEO_REGION_CELLS x GEO_REGION_CELLS) -- sliced into the frontend's
 * smaller streaming tile unit by slice-geo-tile.ts. No re-encoding: this is
 * the exact community .l2j layout, not a bespoke format of our own.
 *
 * Block/cell read order (X-major: index = x * size + y) is cross-checked
 * against lineage2ts's own read-side index formulas (GeoRegion.getBasePolygonIndex,
 * CommonOperations.getCellIndex), not guessed.
 *
 * MultiLayer blocks (bridges/tunnels, multiple Z per cell) write every layer
 * into the CSR layerHeights/layerNswe fields (bottom to top); heights/nswe
 * still get the single highest layer, kept as GeoTile's fast "top layer"
 * path for consumers that don't need the full stack.
 */
export function parseL2jRegion(buffer: ArrayBuffer): GeoTile {
  const view = new DataView(buffer);
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
    // Row-major, matching GeoTile.heights's own documented convention.
    const index = cellY * GEO_REGION_CELLS + cellX;
    const height = extractHeight(value);
    const nsweValue = extractNswe(value);
    heights[index] = height;
    nswe[index] = nsweValue;
    // Flat/MultiHeight cells are single-layer -- their one layer is the same value.
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
