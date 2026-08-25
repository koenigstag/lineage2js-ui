import { GEO_BLOCK_CELLS } from "../../config/geodata";
import type { GeoTile } from "./geo-tile.types";

export type GeoBlockType = "FLAT" | "COMPLEX" | "MULTI";

/**
 * Heuristically classifies the raw L2J block (see l2j-region-reader.ts on
 * the assets-server side) containing tile-local cell (cellX, cellY), from
 * this project's own already-decoded per-cell tile data -- the original raw
 * block type itself isn't stored in this project's tile format (every
 * single-layer cell round-trips through the same height+nswe shape
 * regardless of whether it came from a FLAT or COMPLEX/MultiHeight block),
 * so this infers it from the decoded shape instead: any cell in the block
 * with more than one layer means MULTI (MultiLayer); otherwise, since a
 * genuine FLAT block shares one identical height+nswe across its whole 8x8
 * cell group by construction, all 64 cells matching the first one means
 * FLAT, and any cell differing means COMPLEX (MultiHeight, each cell its
 * own value). Good enough for a debug readout; not a substitute for a real
 * .l2j editor when it matters (a MultiHeight block that happens to have
 * uniform values everywhere would misclassify as FLAT).
 */
export function classifyBlockType(tile: GeoTile, cellX: number, cellY: number): GeoBlockType {
  const { cellsX, heights, nswe, layerCounts } = tile;
  const blockX0 = Math.floor(cellX / GEO_BLOCK_CELLS) * GEO_BLOCK_CELLS;
  const blockY0 = Math.floor(cellY / GEO_BLOCK_CELLS) * GEO_BLOCK_CELLS;

  const firstIndex = blockY0 * cellsX + blockX0;
  const firstHeight = heights[firstIndex];
  const firstNswe = nswe[firstIndex];

  let uniform = true;
  for (let y = blockY0; y < blockY0 + GEO_BLOCK_CELLS; y++) {
    for (let x = blockX0; x < blockX0 + GEO_BLOCK_CELLS; x++) {
      const index = y * cellsX + x;
      if (layerCounts[index] > 1) {
        return "MULTI";
      }
      if (heights[index] !== firstHeight || nswe[index] !== firstNswe) {
        uniform = false;
      }
    }
  }

  return uniform ? "FLAT" : "COMPLEX";
}
