/**
 * Rewrites a Unity AnimationClip onto the three.js side of the same rig.
 *
 * Unity imports these FBX rigs into a left-handed, Y-up frame; three's
 * FBXLoader imports the very same files into a right-handed, Y-up one. The two
 * differ by a single reflection through the YZ plane, which was confirmed
 * against the project's own prefabs rather than assumed: converting every bone
 * rest rotation in `MFighter_anim_user.prefab` by (x, -y, -z, w) reproduces
 * FBXLoader's rest rotation for all 92 bones to within 0.005 degrees, and the
 * matching position rule (-x, y, z) lines up with FBXLoader's rest positions at
 * a single uniform ratio -- Unity's own `globalScale` import factor -- across
 * every bone.
 */
import * as THREE from "three";
import type { UnityAnimationClip } from "./unity-anim";

export interface ClipTargetRig {
  /** Bone names present on the rig being animated; curves for anything else are dropped. */
  boneNames: Set<string>;
  /** Name of the rig's root bone -- the only bone whose translation is kept. */
  rootBone: string;
  /** Unity's FBX import scale for this rig, undoing the clip's Unity-space units. */
  unityScale: number;
  /**
   * Height ratio target/donor when the clip was authored for a different rig.
   * Scales root translation so a dwarf driven by a human clip still sits and
   * falls at its own height. 1 for a rig's own clips.
   */
  rootMotionScale: number;
}

/** Keeps a walk/run cycle playing in place -- world position comes from the server, not the clip. */
export interface ClipOptions {
  inPlace?: boolean;
}

function convertQuaternionKeys(keys: UnityAnimationClip["rotations"][number]["keys"]): {
  times: number[];
  values: number[];
} {
  const times: number[] = [];
  const values: number[] = [];
  let previous: [number, number, number, number] | null = null;

  for (const key of keys) {
    const [x, y, z, w] = key.value;
    let converted: [number, number, number, number] = [x, -y, -z, w];
    // q and -q are the same rotation but interpolate the long way round
    // against a neighbour of the opposite sign; keep the whole track on one
    // hemisphere so slerp never takes the detour.
    if (previous && previous[0] * converted[0] + previous[1] * converted[1] + previous[2] * converted[2] + previous[3] * converted[3] < 0) {
      converted = [-converted[0], -converted[1], -converted[2], -converted[3]];
    }
    previous = converted;
    times.push(key.time);
    values.push(...converted);
  }

  return { times, values };
}

export function toThreeClip(
  name: string,
  source: UnityAnimationClip,
  rig: ClipTargetRig,
  options: ClipOptions = {}
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  for (const curve of source.rotations) {
    const bone = THREE.PropertyBinding.sanitizeNodeName(curve.target);
    if (!rig.boneNames.has(bone) || curve.keys.length === 0) continue;
    const { times, values } = convertQuaternionKeys(curve.keys);
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }

  // Bone translations other than the root's only ever encode bone lengths --
  // keeping them would stamp the clip author's proportions onto whichever rig
  // is playing it, which is exactly what breaks when a dwarf borrows a human's
  // animation. The root's translation is the clip's actual motion (a body
  // dropping in Death, lowering in Sit) and is kept, rescaled.
  const rootCurve = source.positions.find(
    (curve) => THREE.PropertyBinding.sanitizeNodeName(curve.target) === rig.rootBone
  );
  if (rootCurve && rootCurve.keys.length > 0) {
    const scale = (1 / rig.unityScale) * rig.rootMotionScale;
    const first = rootCurve.keys[0].value;
    const times: number[] = [];
    const values: number[] = [];
    for (const key of rootCurve.keys) {
      const [x, y, z] = options.inPlace ? [first[0], key.value[1], first[2]] : key.value;
      times.push(key.time);
      values.push(-x * scale, y * scale, z * scale);
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${rig.rootBone}.position`, times, values));
  }

  const clip = new THREE.AnimationClip(name, -1, tracks);
  clip.resetDuration();
  // Unity's stop time is the authored loop length, which can run past the last
  // keyframe (a cycle that holds its final pose for a beat before repeating).
  if (source.stopTime > clip.duration) clip.duration = source.stopTime;
  return clip;
}
