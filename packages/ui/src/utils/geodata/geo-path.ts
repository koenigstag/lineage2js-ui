import {
  GEO_MAX_PATH_CELLS,
  GEO_MAX_STEP_UP_HEIGHT,
  GEO_SAME_LEVEL_TOLERANCE,
} from "../../config/geodata";
import {
  NSWE_EAST,
  NSWE_NORTH,
  NSWE_SOUTH,
  NSWE_WEST,
  findGeoCell,
  geoCellCenter,
  hasGeoSurface,
  highestLayerNodeBelow,
  nearestLayerNode,
  worldToGeoCell,
} from "./geo-cells";
import type { LoadedGeoTile } from "./use-geo-tiles";

export type GeoPathVerdict =
  /** Geodata says the whole straight line is walkable and ends on the requested level. */
  | "clear"
  /** No geodata covers this line (not configured, or the tiles aren't loaded) -- nothing to judge by. */
  | "unverified"
  /** A cell's NSWE mask forbids leaving it in the direction the line goes. */
  | "nswe"
  /** The next cell's only surfaces sit more than GEO_MAX_STEP_UP_HEIGHT above us -- a wall/ledge at our level. */
  | "climb"
  /** A cell on the line has no surface at all (the .l2j "no data" sentinel). */
  | "hole"
  /** The line is walkable but lands on a different layer than the destination -- e.g. the ground under a bridge we clicked the deck of. */
  | "level";

export interface GeoPathResult {
  /** False only when geodata positively says the line is blocked -- "unverified" keeps this true. */
  canMove: boolean;
  verdict: GeoPathVerdict;
  /** Last position actually reachable along the line (the destination's own cell when clear), for debugging/logging. */
  stopAt: { x: number; y: number; z: number };
}

interface WalkPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Walks the straight line between two L2 world positions cell by cell and
 * reports whether geodata allows it -- the check a move order (and a click
 * that would send one) has to pass before the packet goes out.
 *
 * Deliberately a *straight line* test, not a pathfinder: the server moves us
 * in a straight line to whatever MoveBackwardToLocation asks for, so anything
 * the line can't cross is an obstacle for this order, even when a way around
 * exists. Modelled on the reference server's own geodata move validation
 * (L2J's GeoEngine.checkMove): Bresenham over geo-cells, each step gated on
 * the NSWE mask of the layer we're standing on, with a diagonal step also
 * requiring both cells it cuts the corner between to be open the
 * complementary way, so a diagonal can't slip through a wall junction two
 * cardinal steps couldn't.
 *
 * Z is tracked along the walk rather than assumed flat, which is what makes
 * "blocks at the player's own level" work: stepping into a cell picks that
 * cell's highest surface no more than GEO_MAX_STEP_UP_HEIGHT above the one
 * we're on (see highestLayerNodeBelow). Anything higher is a wall, and the
 * order is refused. Anything lower is a drop, which is always allowed as long
 * as NSWE lets us leave the cell we're in -- falling is legal, climbing isn't.
 * Finally the surface actually walked to has to match the destination's own
 * surface (GEO_SAME_LEVEL_TOLERANCE), so clicking a bridge deck from
 * underneath it is refused instead of silently ordering a walk along the
 * ground below.
 *
 * Missing geodata is split in two on purpose. A cell whose *tile* simply
 * isn't loaded (or a build with no geodata configured at all) reports
 * "unverified" and lets the order through -- refusing to move because data
 * hasn't been fetched would be far worse than not checking. A cell that *is*
 * loaded but holds the .l2j "no data" sentinel is a real hole in the world,
 * and blocks.
 */
export function canMoveStraight(
  tiles: LoadedGeoTile[],
  from: WalkPosition,
  to: WalkPosition
): GeoPathResult {
  const [fromCellX, fromCellY] = worldToGeoCell(from.x, from.y);
  const [toCellX, toCellY] = worldToGeoCell(to.x, to.y);

  const originCell = findGeoCell(tiles, fromCellX, fromCellY);
  if (!originCell) {
    return unverified(from);
  }
  let node = nearestLayerNode(originCell, from.z);
  if (node < 0) {
    // Standing on a hole -- geodata disagrees with where the server put us,
    // so it has no business vetoing where we go from here.
    return unverified(from);
  }

  let currentCell = originCell;
  let currentZ = originCell.tile.layerHeights[node];
  let currentNswe = originCell.tile.layerNswe[node];
  let cellX = fromCellX;
  let cellY = fromCellY;

  const dx = Math.abs(toCellX - fromCellX);
  const dy = Math.abs(toCellY - fromCellY);
  if (dx + dy > GEO_MAX_PATH_CELLS) {
    return unverified(from);
  }
  const sx = fromCellX < toCellX ? 1 : -1;
  const sy = fromCellY < toCellY ? 1 : -1;
  let error = dx - dy;

  while (cellX !== toCellX || cellY !== toCellY) {
    // Standard Bresenham step selection: the doubled error decides whether
    // this step is diagonal, horizontal or vertical.
    const doubledError = 2 * error;
    let stepX = 0;
    let stepY = 0;
    if (doubledError > -dy && doubledError < dx) {
      error += dx - dy;
      stepX = sx;
      stepY = sy;
    } else if (doubledError > -dy) {
      error -= dy;
      stepX = sx;
    } else {
      error += dx;
      stepY = sy;
    }

    const directionX = stepX > 0 ? NSWE_EAST : NSWE_WEST;
    const directionY = stepY > 0 ? NSWE_SOUTH : NSWE_NORTH;

    if (stepX !== 0 && (currentNswe & directionX) === 0) {
      return blocked("nswe", cellX, cellY, currentZ);
    }
    if (stepY !== 0 && (currentNswe & directionY) === 0) {
      return blocked("nswe", cellX, cellY, currentZ);
    }
    if (stepX !== 0 && stepY !== 0) {
      // Anti corner-cut: a diagonal is only open if both cells it passes
      // between let the other half of the move through as well. Without this
      // a diagonal walks straight through the inside corner of a wall.
      if (
        !isCellOpen(tiles, cellX + stepX, cellY, currentZ, directionY) ||
        !isCellOpen(tiles, cellX, cellY + stepY, currentZ, directionX)
      ) {
        return blocked("nswe", cellX, cellY, currentZ);
      }
    }

    cellX += stepX;
    cellY += stepY;

    const cell = findGeoCell(tiles, cellX, cellY);
    if (!cell) {
      return unverified({ x: from.x, y: from.y, z: currentZ });
    }

    node = highestLayerNodeBelow(cell, currentZ + GEO_MAX_STEP_UP_HEIGHT);
    if (node < 0) {
      // Nothing to stand on within a step of our level: either the cell is a
      // hole, or every surface it has is above us -- a wall, not a step.
      return blocked(hasGeoSurface(cell) ? "climb" : "hole", cellX - stepX, cellY - stepY, currentZ);
    }

    currentCell = cell;
    currentZ = cell.tile.layerHeights[node];
    currentNswe = cell.tile.layerNswe[node];
  }

  // Compare against the destination's *own* surface rather than the raw Z
  // handed in. For a ground click those are the same value (the click came
  // off the terrain mesh, which is drawn straight from these layers), but a
  // creature's Z is the server's, and it drifts a little from geodata --
  // and floats well above it outright for anything airborne. Resolving it to
  // a layer first keeps the check answering "is this the level I'm on?"
  // instead of quietly turning into "does the server agree with our
  // geodata?".
  const destinationNode = nearestLayerNode(currentCell, to.z);
  const destinationZ = destinationNode < 0 ? to.z : currentCell.tile.layerHeights[destinationNode];
  if (Math.abs(currentZ - destinationZ) > GEO_SAME_LEVEL_TOLERANCE) {
    return blocked("level", cellX, cellY, currentZ);
  }

  return { canMove: true, verdict: "clear", stopAt: { x: to.x, y: to.y, z: currentZ } };
}

/** Whether the surface nearest `referenceZ` in that cell may be left in `direction`. An unloaded cell isn't judged; a hole always blocks. */
function isCellOpen(
  tiles: LoadedGeoTile[],
  cellX: number,
  cellY: number,
  referenceZ: number,
  direction: number
): boolean {
  const cell = findGeoCell(tiles, cellX, cellY);
  if (!cell) {
    return true;
  }
  const node = nearestLayerNode(cell, referenceZ);
  if (node < 0) {
    return false;
  }
  return (cell.tile.layerNswe[node] & direction) !== 0;
}

function unverified(stopAt: WalkPosition): GeoPathResult {
  return { canMove: true, verdict: "unverified", stopAt };
}

function blocked(verdict: GeoPathVerdict, cellX: number, cellY: number, z: number): GeoPathResult {
  const [x, y] = geoCellCenter(cellX, cellY);
  return { canMove: false, verdict, stopAt: { x, y, z } };
}
