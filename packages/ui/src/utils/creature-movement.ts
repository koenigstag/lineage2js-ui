import type { WorldCreatureSnapshot } from "../stores/GameStore";

export interface CreatureWorldPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Analytic L2 world position for "now" along the creature's current move
 * segment (moveFrom -> moveTo at `speed` world units/sec, started at
 * moveStartedAt) -- smooth at any frame rate, unlike snapping to wherever
 * L2Creature's own coarse ~100ms setMovingTo() steps last landed (see that
 * class's field comment for why those exist and why they're too sparse to
 * look smooth at 60fps). Falls back to the snapshot's plain x/y/z (already
 * the resting position) when not moving, or once the segment is spent.
 */
export function interpolatedCreaturePosition(
  creature: WorldCreatureSnapshot,
  now: number = Date.now()
): CreatureWorldPosition {
  const { moveFrom, moveTo, moveStartedAt, speed } = creature;
  if (!creature.isMoving || !moveFrom || !moveTo || moveStartedAt === undefined || !speed) {
    return { x: creature.x, y: creature.y, z: creature.z };
  }

  const totalDx = moveTo.x - moveFrom.x;
  const totalDy = moveTo.y - moveFrom.y;
  const totalDistance = Math.hypot(totalDx, totalDy);
  if (totalDistance === 0) {
    return { x: creature.x, y: creature.y, z: creature.z };
  }

  const elapsedSeconds = (now - moveStartedAt) / 1000;
  const t = Math.min(speed * elapsedSeconds, totalDistance) / totalDistance;

  return {
    x: moveFrom.x + totalDx * t,
    y: moveFrom.y + totalDy * t,
    z: moveFrom.z + (moveTo.z - moveFrom.z) * t,
  };
}
