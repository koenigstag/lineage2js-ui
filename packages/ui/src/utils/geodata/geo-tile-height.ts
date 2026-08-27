import { findGeoCell, nearestLayerNode, worldToGeoCell } from "./geo-cells";
import { loadedGeoTiles } from "./geo-tile-index";
import type { LoadedGeoTile } from "./use-geo-tiles";

/**
 * Top-layer height (L2 Z) at a world (x, y), or null if that cell isn't
 * loaded. Ignores multi-layer cells entirely -- the fast path for callers
 * that have no Z of their own to disambiguate with (the local test character,
 * which starts at world origin with no server-reported position at all). Use
 * surfaceHeightAtWorld once a reference Z exists.
 */
export function heightAtWorld(tiles: LoadedGeoTile[], worldX: number, worldY: number): number | null {
  const [cellX, cellY] = worldToGeoCell(worldX, worldY);
  const cell = findGeoCell(tiles, cellX, cellY);
  return cell ? cell.tile.heights[cell.index] : null;
}

/**
 * Height (L2 Z) of the geodata surface under a world (x, y) *on the layer the
 * creature is actually on* -- the layer closest to `referenceZ`, so someone
 * crossing a bridge stays on the deck instead of being pulled down to the
 * ground it spans. Null when nothing is loaded there, or the cell is a hole.
 *
 * This is the "gravity" lookup: rendered Z comes from the surface here rather
 * than from interpolating between a move segment's endpoints (see
 * creature-movement.ts).
 */
export function surfaceHeightAtWorld(
  tiles: LoadedGeoTile[],
  worldX: number,
  worldY: number,
  referenceZ: number
): number | null {
  const [cellX, cellY] = worldToGeoCell(worldX, worldY);
  const cell = findGeoCell(tiles, cellX, cellY);
  if (!cell) {
    return null;
  }
  const node = nearestLayerNode(cell, referenceZ);
  return node < 0 ? null : cell.tile.layerHeights[node];
}

/** surfaceHeightAtWorld against whatever is loaded app-wide -- for callers outside the React tree, see geo-tile-index.ts. */
export function loadedSurfaceHeightAtWorld(worldX: number, worldY: number, referenceZ: number): number | null {
  return surfaceHeightAtWorld(loadedGeoTiles(), worldX, worldY, referenceZ);
}
