import * as THREE from "three";

/**
 * L2 world space is Z-up, units are ~centimeters. three.js is Y-up; the
 * character pipeline (components/screens/character-select/scene) normalizes
 * models to ~1.7 units tall, so the world renders at 1 unit = 1m (L2 -> m:
 * x0.01). Axis mapping and the heading formula match
 * https://github.com/elberacasa/Lineage2Elbera (MIT) editor/world/js/coords.js,
 * verified there against the aCis server sources -- keep both in sync if
 * either changes.
 */
export const L2_TO_THREE_SCALE = 0.01;

export function l2ToThree(x: number, y: number, z: number, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x * L2_TO_THREE_SCALE, z * L2_TO_THREE_SCALE, -y * L2_TO_THREE_SCALE);
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
    y: Math.round(-position.z / L2_TO_THREE_SCALE),
    z: Math.round(position.y / L2_TO_THREE_SCALE),
  };
}

/**
 * L2 heading (0..65535) -> three.js yaw (rotation.y, 0 facing +Z_three).
 * aCis MathUtil.calculateHeadingFrom = atan2(dy, dx) * 65536/2pi: the facing
 * direction is (cos t, sin t) in L2 (x, y), which is (cos t, -sin t) in
 * three space, so yaw = atan2(cos t, -sin t) = pi/2 + t.
 */
export function l2HeadingToThreeYaw(heading: number): number {
  return Math.PI / 2 + (heading || 0) * ((Math.PI * 2) / 65536);
}
