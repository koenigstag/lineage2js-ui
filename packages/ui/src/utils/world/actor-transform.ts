import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { STATIC_MESH_SCALE } from "../../config/world-assets";
import { l2ToThree } from "../coords";
import type { MapActor } from "./map-scene.types";

/** Unreal rotator units -> radians. 65536 to the turn, not 360. */
const ROTATOR_TO_RADIANS = (Math.PI * 2) / 65536;

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const euler = new Euler();

/**
 * World matrix for one placed static mesh.
 *
 * The rotation is the part worth explaining. A mesh sits in the package's own
 * Unreal frame (X forward, Y right, Z up), and utils/coords maps L2/Unreal
 * (x, y, z) to three (x, z, y) -- a swap of two axes, so a *reflection*, which
 * is what flips the handedness of every rotation that passes through it. Under
 * it:
 *
 *   Unreal yaw   is about Z_ue = Y_three  -> rotation about Y, negated
 *   Unreal pitch is about Y_ue = Z_three  -> rotation about Z, negated
 *   Unreal roll  is about X_ue = X_three  -> rotation about X, negated
 *
 * Unreal composes them yaw, then pitch, then roll (R = Rz.Ry.Rx in its own
 * frame), which after the swap is Ry.Rz.Rx -- three's "YZX" Euler order.
 *
 * Nearly every actor in the client is yaw-only, so that term is the one that
 * matters in practice; the other two are here to be correct on the handful
 * (leaning signposts, tilted rubble) that use them.
 */
export function actorMatrix(actor: MapActor, out: Matrix4 = new Matrix4()): Matrix4 {
  const [x, y, z] = actor.pos;
  l2ToThree(x, y, z, position);

  const [pitch = 0, yaw = 0, roll = 0] = actor.rot ?? [];
  euler.set(-roll * ROTATOR_TO_RADIANS, -yaw * ROTATOR_TO_RADIANS, -pitch * ROTATOR_TO_RADIANS, "YZX");
  quaternion.setFromEuler(euler);

  // Per-axis scale is in Unreal axes too, so it goes through the same swap.
  const [sx = 1, sy = 1, sz = 1] = actor.scale ?? [];
  scale.set(sx * STATIC_MESH_SCALE, sz * STATIC_MESH_SCALE, sy * STATIC_MESH_SCALE);

  return out.compose(position, quaternion, scale);
}
