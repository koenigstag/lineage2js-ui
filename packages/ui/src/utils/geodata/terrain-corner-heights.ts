import { GEO_NO_DATA_HEIGHT, GEO_TERRAIN_WELD_MAX_DELTA } from "../../config/geodata";
import type { GeoTile } from "./geo-tile.types";

/**
 * The 8 tiles around one tile, as far as they happen to be loaded right now
 * (see use-geo-tiles.ts -- the ring streams in and gets evicted again as the
 * player moves). North is -y, south is +y, matching the NSWE axes in
 * geo-cells.ts.
 *
 * Only needed so the weld below can see across a tile seam: without it the
 * outermost row/column of cells would average over their in-tile neighbors
 * only, and every 1024-unit tile border would keep a small step exactly
 * where the rest of the terrain just became continuous.
 */
export interface GeoTileNeighbors {
  north?: GeoTile;
  south?: GeoTile;
  west?: GeoTile;
  east?: GeoTile;
  northWest?: GeoTile;
  northEast?: GeoTile;
  southWest?: GeoTile;
  southEast?: GeoTile;
}

/**
 * Corners of a cell quad, indexed slot = cornerLocalY * 2 + cornerLocalX:
 * 0 = (x, y), 1 = (x+1, y), 2 = (x, y+1), 3 = (x+1, y+1) -- the same A/B/C/D
 * order buildCellQuads writes its four vertices in.
 */
export const CORNERS_PER_CELL = 4;

interface CornerCandidate {
  /**
   * Index into the corner-height array being built, or -1 for a layer that
   * belongs to a neighboring tile (that tile computes its own corners, from
   * this same candidate set, and lands on the same value).
   */
  target: number;
  /** Which of the (up to) 4 cells meeting at this corner the layer came from -- see the same-cell rule below. */
  cell: number;
  height: number;
}

/**
 * Per-(cell, layer) corner heights for the independent-quad terrain mesh:
 * every quad corner is pulled to the average of the layers meeting at that
 * grid point that are within GEO_TERRAIN_WELD_MAX_DELTA of each other, so
 * neighboring cells differing by only a step or two of the geodata's own
 * 8-unit Z quantization render as one continuous (tilted) surface instead
 * of a mosaic of flat platforms with a visible step between every pair.
 * Returns a flat array indexed `node * CORNERS_PER_CELL + slot`.
 *
 * Deliberately weaker than the full mesh stitching behind
 * VITE_GEODATA_TERRAIN_SMOOTH (buildSheets in
 * geo-terrain-tile.component.tsx): that one connects a layer to its closest
 * available match at any distance and re-triangulates whole sheets, which
 * takes a judgment call this doesn't have to make. Here a layer is only
 * ever moved towards layers it is already nearly level with, every quad
 * stays its own independent quad (nothing is merged, so nothing can go
 * missing), and where no neighbor is close enough the corner keeps its own
 * exact height and the step stays as crisp as it is today.
 *
 * Agreement across the grid comes from clustering per *corner* rather than
 * per cell: the (up to) 4 cells sharing a grid point all see the same
 * candidate list and run the same deterministic clustering over it, so they
 * agree on the welded height to the bit and their quads meet exactly --
 * no cracks, without sharing a single vertex.
 */
export function computeCornerHeights(tile: GeoTile, neighbors: GeoTileNeighbors = {}): Float32Array {
  const { cellsX, cellsY, layerOffsets, layerHeights } = tile;
  const totalNodes = layerOffsets[cellsX * cellsY];

  const cornerHeights = new Float32Array(totalNodes * CORNERS_PER_CELL);
  for (let node = 0; node < totalNodes; node++) {
    cornerHeights.fill(layerHeights[node], node * CORNERS_PER_CELL, (node + 1) * CORNERS_PER_CELL);
  }

  /** The tile holding a cell address up to one cell outside this tile, or undefined when that neighbor isn't loaded. */
  function neighborFor(x: number, y: number): GeoTile | undefined {
    if (y < 0) {
      return x < 0 ? neighbors.northWest : x >= cellsX ? neighbors.northEast : neighbors.north;
    }
    if (y >= cellsY) {
      return x < 0 ? neighbors.southWest : x >= cellsX ? neighbors.southEast : neighbors.south;
    }
    return x < 0 ? neighbors.west : neighbors.east;
  }

  function resolveCell(x: number, y: number): { tile: GeoTile; index: number } | undefined {
    if (x >= 0 && x < cellsX && y >= 0 && y < cellsY) {
      return { tile, index: y * cellsX + x };
    }
    const neighbor = neighborFor(x, y);
    // A differently-sized neighbor can't be addressed by the wrap-around
    // below -- tiles are uniformly GEO_TILE_CELLS in practice, so skip it
    // rather than index it wrong.
    if (!neighbor || neighbor.cellsX !== cellsX || neighbor.cellsY !== cellsY) {
      return undefined;
    }
    // x/y are never more than one cell out of range, so this maps -1 onto
    // the neighbor's last row/column and cellsX/cellsY onto its first.
    return { tile: neighbor, index: ((y + cellsY) % cellsY) * cellsX + ((x + cellsX) % cellsX) };
  }

  const candidates: CornerCandidate[] = [];

  for (let cornerY = 0; cornerY <= cellsY; cornerY++) {
    for (let cornerX = 0; cornerX <= cellsX; cornerX++) {
      candidates.length = 0;

      for (let cell = 0; cell < 4; cell++) {
        const dx = cell & 1;
        const dy = cell >> 1;
        const resolved = resolveCell(cornerX - 1 + dx, cornerY - 1 + dy);
        if (!resolved) {
          continue;
        }
        // This grid point is that cell's own (1 - dx, 1 - dy) corner.
        const slot = (1 - dy) * 2 + (1 - dx);
        const isOwnTile = resolved.tile === tile;
        const layerEnd = resolved.tile.layerOffsets[resolved.index + 1];
        for (let node = resolved.tile.layerOffsets[resolved.index]; node < layerEnd; node++) {
          const height = resolved.tile.layerHeights[node];
          if (height === GEO_NO_DATA_HEIGHT) {
            continue; // a hole in the world, not a surface -- never welded to anything.
          }
          candidates.push({ target: isOwnTile ? node * CORNERS_PER_CELL + slot : -1, cell, height });
        }
      }

      if (candidates.length < 2) {
        continue; // nothing to weld to -- the corner keeps its own height.
      }
      candidates.sort((a, b) => a.height - b.height);

      // Single-linkage clustering over the sorted heights: a run of layers
      // each within GEO_TERRAIN_WELD_MAX_DELTA of the one below it is one
      // surface, and averaging is what actually smooths a slope (on a
      // uniform one the averaged corners put the surface back through every
      // cell's own height at that cell's center). Chaining can't run away
      // across the tile the way single-linkage normally could -- a cluster
      // only ever spans the <=4 cells touching this one grid point.
      let clusterStart = 0;
      let clusterCells = 0; // bitmask over `cell`, see the same-cell rule below
      let sum = 0;

      for (let i = 0; i <= candidates.length; i++) {
        const endsCluster =
          i === candidates.length ||
          (i > clusterStart &&
            (candidates[i].height - candidates[i - 1].height > GEO_TERRAIN_WELD_MAX_DELTA ||
              // Two layers of the SAME cell in one cluster would fuse a
              // stacked structure (a bridge deck and the ground under it)
              // into a single surface. Real geodata never stacks layers
              // anywhere near this close, but keep that structurally
              // impossible instead of relying on it -- the same invariant
              // buildSheets enforces for the stitched mode.
              (clusterCells & (1 << candidates[i].cell)) !== 0));

        if (endsCluster) {
          const size = i - clusterStart;
          if (size > 1) {
            const welded = sum / size;
            for (let member = clusterStart; member < i; member++) {
              const { target } = candidates[member];
              if (target >= 0) {
                cornerHeights[target] = welded;
              }
            }
          }
          clusterStart = i;
          clusterCells = 0;
          sum = 0;
        }

        if (i < candidates.length) {
          clusterCells |= 1 << candidates[i].cell;
          sum += candidates[i].height;
        }
      }
    }
  }

  return cornerHeights;
}
