import { GEO_MAX_STEP_UP_HEIGHT } from "../../config/geodata";
import { findGeoCell, highestLayerNodeBelow, nearestLayerNode, worldToGeoCell } from "./geo-cells";
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

/**
 * Height (L2 Z) of the surface you would end up on *stepping into* a world
 * (x, y) from `fromZ` -- the cell's highest layer no more than
 * GEO_MAX_STEP_UP_HEIGHT above you.
 *
 * The difference from surfaceHeightAtWorld is what happens at a cave mouth.
 * "Nearest layer" is symmetric: it will happily pull you *up* through a
 * mountain to the slope overhead if that surface is a little closer than the
 * cave floor you were walking on. A ceiling of (fromZ + the step-up
 * allowance) is not symmetric, and that asymmetry is the rule the game
 * actually plays by -- you can step up a little, you can fall any distance,
 * and you cannot climb. So the mountain above the cave is excluded outright
 * and the floor is taken however far below it sits.
 *
 * Null when nothing here is reachable that way: a hole, or a wall whose every
 * surface is above the ceiling. The caller decides what that means -- this
 * answers "what is the ground", not "may I go there", which is
 * canMoveStraight's question and takes NSWE masks and fall limits with it.
 */
export function steppedHeightAtWorld(
  tiles: LoadedGeoTile[],
  worldX: number,
  worldY: number,
  fromZ: number
): number | null {
  const [cellX, cellY] = worldToGeoCell(worldX, worldY);
  const cell = findGeoCell(tiles, cellX, cellY);
  if (!cell) {
    return null;
  }
  const node = highestLayerNodeBelow(cell, fromZ + GEO_MAX_STEP_UP_HEIGHT);
  return node < 0 ? null : cell.tile.layerHeights[node];
}

/** surfaceHeightAtWorld against whatever is loaded app-wide -- for callers outside the React tree, see geo-tile-index.ts. */
export function loadedSurfaceHeightAtWorld(worldX: number, worldY: number, referenceZ: number): number | null {
  return surfaceHeightAtWorld(loadedGeoTiles(), worldX, worldY, referenceZ);
}

/** heightAtWorld against whatever is loaded app-wide. See loadedSurfaceHeightAtWorld. */
export function loadedHeightAtWorld(worldX: number, worldY: number): number | null {
  return heightAtWorld(loadedGeoTiles(), worldX, worldY);
}

/** steppedHeightAtWorld against whatever is loaded app-wide. See loadedSurfaceHeightAtWorld. */
export function loadedSteppedHeightAtWorld(worldX: number, worldY: number, fromZ: number): number | null {
  return steppedHeightAtWorld(loadedGeoTiles(), worldX, worldY, fromZ);
}
