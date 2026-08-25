import * as THREE from "three";

/**
 * L2 world space is Z-up, units are ~centimeters. three.js is Y-up; the
 * character pipeline (components/screens/character-select/scene) normalizes
 * models to ~1.7 units tall, so the world renders at 1 unit = 1m (L2 -> m:
 * x0.01).
 *
 * Axis mapping: L2 (x, y) -> three (x, z) directly, with no sign flip on
 * either horizontal axis. An earlier version negated y (`-y * SCALE`) on the
 * assumption that L2 y needed flipping to land in three's z; that produced a
 * left-right mirrored world (confirmed by cross-referencing real spawn
 * coordinates -- e.g. Elf starting area's Nerupa/Newbie Helper, and the
 * Grand Olympiad Manager/Monument of Heroes pair repeated in every town --
 * against in-game left/right observations in the retail client). Flipping
 * exactly one of x/y (not both -- that's just a 180 degree turn, not a
 * mirror) fixes the chirality; y was chosen since it's the smaller diff.
 * l2HeadingToThreeYaw is derived to match: CharacterModel's model faces
 * local +Z (see its "nose" mesh), so rotation.y = yaw must send local
 * (0,0,1) to the L2 facing direction (cos t, sin t) mapped straight through
 * this same (x, y) -> (x, z) mapping.
 */
export const L2_TO_THREE_SCALE = 0.01;

export function l2ToThree(x: number, y: number, z: number, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x * L2_TO_THREE_SCALE, z * L2_TO_THREE_SCALE, y * L2_TO_THREE_SCALE);
}

export interface L2Position {
  x: number;
  y: number;
  z: number;
}

/** three.js world -> L2 world (inverse of l2ToThree). */
export function threeToL2(position: THREE.Vector3): L2Position {
  return {
    x: Math.round(position.x / L2_TO_THREE_SCALE),
    y: Math.round(position.z / L2_TO_THREE_SCALE),
    z: Math.round(position.y / L2_TO_THREE_SCALE),
  };
}

/**
 * L2 heading (0..65535) -> three.js yaw (rotation.y, 0 facing +Z_three).
 * aCis MathUtil.calculateHeadingFrom = atan2(dy, dx) * 65536/2pi: the facing
 * direction is (cos t, sin t) in L2 (x, y), which under the unmirrored (x,
 * y) -> (x, z) mapping above is (cos t, sin t) in three (x, z) too. Model
 * local forward is +Z (CharacterModel), and rotation.y = yaw sends local
 * (0,0,1) to world (sin yaw, cos yaw) -- so sin yaw = cos t, cos yaw = sin t,
 * i.e. yaw = pi/2 - t.
 */
export function l2HeadingToThreeYaw(heading: number): number {
  return Math.PI / 2 - (heading || 0) * ((Math.PI * 2) / 65536);
}
