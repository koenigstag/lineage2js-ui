import { GEO_CELL_SIZE, GEO_NO_DATA_HEIGHT, GEO_TILE_CELLS } from "../../config/geodata";
import type { GeoTile } from "./geo-tile.types";
import type { LoadedGeoTile } from "./use-geo-tiles";

/**
 * NSWE passability bits, exactly as the raw .l2j cell value packs them (see
 * l2j-region-reader.ts's extractNswe, which carries them through the offline
 * bake untouched). A set bit means "leaving this cell in that direction is
 * allowed"; the mask is per *layer*, not per cell, so a bridge deck and the
 * ground beneath it each have their own.
 *
 * Directions are in L2 world axes: +x is EAST, +y is SOUTH (matching how
 * geo-terrain-tile.component.tsx's mesh stitching already walks neighbors).
 */
export const NSWE_EAST = 1;
export const NSWE_WEST = 2;
export const NSWE_SOUTH = 4;
export const NSWE_NORTH = 8;

/**
 * One geo-cell resolved down to the tile that holds it. `index` is row-major
 * within that tile (y * cellsX + x), the same indexing heights/nswe/
 * layerCounts/layerOffsets all use -- read a layer through
 * tile.layerHeights[node]/tile.layerNswe[node] with a node from
 * nearestLayerNode/highestLayerNodeBelow below.
 */
export interface GeoCell {
  tile: GeoTile;
  index: number;
}

/**
 * Global geo-cell coordinates covering an L2 world (x, y) -- world-wide and
 * signed, not the region-relative 0..2047 pair worldToCellCoords returns for
 * the .l2j-editor-style debug readout.
 */
export function worldToGeoCell(worldX: number, worldY: number): [cellX: number, cellY: number] {
  return [Math.floor(worldX / GEO_CELL_SIZE), Math.floor(worldY / GEO_CELL_SIZE)];
}

/** World (x, y) at the centre of a global geo-cell. */
export function geoCellCenter(cellX: number, cellY: number): [worldX: number, worldY: number] {
  return [cellX * GEO_CELL_SIZE + GEO_CELL_SIZE / 2, cellY * GEO_CELL_SIZE + GEO_CELL_SIZE / 2];
}

/** Resolves a global geo-cell against the loaded tiles, or undefined when its tile isn't loaded. */
export function findGeoCell(tiles: LoadedGeoTile[], cellX: number, cellY: number): GeoCell | undefined {
  const tileX = Math.floor(cellX / GEO_TILE_CELLS);
  const tileY = Math.floor(cellY / GEO_TILE_CELLS);
  const loaded = tiles.find((t) => t.tileX === tileX && t.tileY === tileY);
  if (!loaded) {
    return undefined;
  }
  const localX = cellX - tileX * GEO_TILE_CELLS;
  const localY = cellY - tileY * GEO_TILE_CELLS;
  return { tile: loaded.tile, index: localY * loaded.tile.cellsX + localX };
}

/** True when the cell holds at least one real surface (a hole-sentinel-only cell doesn't). */
export function hasGeoSurface(cell: GeoCell): boolean {
  const { layerOffsets, layerHeights } = cell.tile;
  for (let node = layerOffsets[cell.index]; node < layerOffsets[cell.index + 1]; node++) {
    if (layerHeights[node] !== GEO_NO_DATA_HEIGHT) {
      return true;
    }
  }
  return false;
}

/**
 * The cell's layer sitting closest to `referenceZ` -- "which surface is this
 * creature standing on", the lookup gravity and the path walk's starting
 * point both need. Returns a node index into tile.layerHeights/tile.layerNswe,
 * or -1 when the cell is a hole.
 */
export function nearestLayerNode(cell: GeoCell, referenceZ: number): number {
  const { layerOffsets, layerHeights } = cell.tile;
  let best = -1;
  let bestDistance = Infinity;
  for (let node = layerOffsets[cell.index]; node < layerOffsets[cell.index + 1]; node++) {
    const height = layerHeights[node];
    if (height === GEO_NO_DATA_HEIGHT) {
      continue;
    }
    const distance = Math.abs(height - referenceZ);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The cell's highest layer at or below `ceilingZ` -- "the surface I'd end up
 * on stepping into this cell", given a ceiling of (current Z + the step-up
 * allowance). Picking the highest rather than the nearest is what makes a
 * one-way drop work: everything below is reachable by falling, so the topmost
 * candidate is the one actually stood on, however far down the next one is.
 * Returns -1 when every layer here is above the ceiling (a wall at our level)
 * or the cell is a hole -- callers tell those apart via hasGeoSurface.
 */
export function highestLayerNodeBelow(cell: GeoCell, ceilingZ: number): number {
  const { layerOffsets, layerHeights } = cell.tile;
  let best = -1;
  let bestHeight = -Infinity;
  for (let node = layerOffsets[cell.index]; node < layerOffsets[cell.index + 1]; node++) {
    const height = layerHeights[node];
    if (height === GEO_NO_DATA_HEIGHT || height > ceilingZ) {
      continue;
    }
    if (height > bestHeight) {
      best = node;
      bestHeight = height;
    }
  }
  return best;
}
