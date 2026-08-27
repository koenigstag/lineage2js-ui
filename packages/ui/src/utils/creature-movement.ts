import { loadedSurfaceHeightAtWorld } from "./geodata/geo-tile-height";

export interface CreatureWorldPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Everything needed to place a creature "now": its last known resting
 * position plus the move segment it's currently on, if any. Built from a live
 * L2Creature by GameStore.creatureMoveState -- WorldCreatureSnapshot is one
 * of these (structurally), so the world scene passes its snapshots straight
 * in, and the position heartbeat can interpolate the local player from the
 * same shape without going through a snapshot at all.
 */
export interface CreatureMoveState {
  x: number;
  y: number;
  z: number;
  isMoving: boolean;
  moveFrom?: { x: number; y: number; z: number };
  moveTo?: { x: number; y: number; z: number };
  /** Date.now() epoch ms when the current move segment started. */
  moveStartedAt?: number;
  /** World units/second along moveFrom -> moveTo. */
  speed?: number;
}

/**
 * Analytic L2 world position for "now" along the creature's current move
 * segment (moveFrom -> moveTo at `speed` world units/sec, started at
 * moveStartedAt) -- smooth at any frame rate, unlike snapping to wherever
 * L2Creature's own coarse ~100ms setMovingTo() steps last landed (see that
 * class's field comment for why those exist and why they're too sparse to
 * look smooth at 60fps). Falls back to the snapshot's plain x/y (already the
 * resting position) when not moving, or once the segment is spent.
 *
 * X/Y only: Z is never interpolated between the segment's endpoints, it's
 * read off the geodata surface under the interpolated (x, y) instead -- see
 * groundedZ. Interpolating Z draws a straight line through whatever the
 * terrain does in between, which is wrong for exactly the cases the terrain
 * is interesting in (walking up a hill cuts through it, walking off a ledge
 * hangs in the air until the segment ends).
 */
export function interpolatedCreaturePosition(
  creature: CreatureMoveState,
  now: number = Date.now()
): CreatureWorldPosition {
  const { moveFrom, moveTo, moveStartedAt, speed } = creature;
  if (!creature.isMoving || !moveFrom || !moveTo || moveStartedAt === undefined || !speed) {
    return { x: creature.x, y: creature.y, z: groundedZ(creature.x, creature.y, creature.z) };
  }

  const totalDx = moveTo.x - moveFrom.x;
  const totalDy = moveTo.y - moveFrom.y;
  const totalDistance = Math.hypot(totalDx, totalDy);
  if (totalDistance === 0) {
    return { x: creature.x, y: creature.y, z: groundedZ(creature.x, creature.y, creature.z) };
  }

  const elapsedSeconds = (now - moveStartedAt) / 1000;
  const t = Math.min(speed * elapsedSeconds, totalDistance) / totalDistance;

  const x = moveFrom.x + totalDx * t;
  const y = moveFrom.y + totalDy * t;
  return { x, y, z: groundedZ(x, y, creature.z) };
}

/**
 * "Gravity": pins a creature to the geodata surface under it rather than
 * trusting a Z that was only ever sampled at the endpoints of a move.
 *
 * The creature's own (server-reported, coarsely updated) Z stays the
 * reference for *which* surface -- a multi-layer cell has several, and the
 * one nearest where the server thinks we are is the one we're on, which is
 * what keeps someone crossing a bridge on the deck instead of dropping to the
 * ground it spans. It's also the fallback when geodata says nothing about
 * this spot (nothing loaded there, or a hole): better a stale Z than a
 * creature at the world's floor.
 */
function groundedZ(x: number, y: number, referenceZ: number): number {
  return loadedSurfaceHeightAtWorld(x, y, referenceZ) ?? referenceZ;
}
