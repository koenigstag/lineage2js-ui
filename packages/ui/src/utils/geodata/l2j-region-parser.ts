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
 * MultiLayer blocks (bridges/tunnels, multiple Z per cell) are collapsed to
 * a single representative height per cell (the highest layer), since
 * GeoTile only models one height per cell -- known limitation.
 */
export function parseL2jRegion(buffer: ArrayBuffer): GeoTile {
  const view = new DataView(buffer);
  let offset = 0;

  const heights = new Int16Array(GEO_REGION_CELLS * GEO_REGION_CELLS);
  const nswe = new Uint8Array(GEO_REGION_CELLS * GEO_REGION_CELLS);

  function writeCell(cellX: number, cellY: number, value: number): void {
    // Row-major, matching GeoTile.heights's own documented convention.
    const index = cellY * GEO_REGION_CELLS + cellX;
    heights[index] = extractHeight(value);
    nswe[index] = extractNswe(value);
  }

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
            writeCell(baseCellX + localX, baseCellY + localY, value);
          }
        }
        continue;
      }

      if (type === GeoBlockType.MultiHeight) {
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            const value = view.getInt16(offset, true);
            offset += 2;
            writeCell(baseCellX + localX, baseCellY + localY, value);
          }
        }
        continue;
      }

      if (type === GeoBlockType.MultiLayer) {
        for (let localX = 0; localX < GEO_BLOCK_CELLS; localX++) {
          for (let localY = 0; localY < GEO_BLOCK_CELLS; localY++) {
            const layerCount = view.getInt8(offset);
            offset += 1;

            let bestValue = LOWEST_HEIGHT;
            let bestHeight = -Infinity;
            for (let layer = 0; layer < layerCount; layer++) {
              const value = view.getInt16(offset, true);
              offset += 2;
              const height = extractHeight(value);
              if (height > bestHeight) {
                bestHeight = height;
                bestValue = value;
              }
            }

            writeCell(baseCellX + localX, baseCellY + localY, bestValue);
          }
        }
        continue;
      }

      throw new Error(`Unknown L2J geo block type: ${type} at byte offset ${offset - 1}`);
    }
  }

  return { cellsX: GEO_REGION_CELLS, cellsY: GEO_REGION_CELLS, heights, nswe };
}
