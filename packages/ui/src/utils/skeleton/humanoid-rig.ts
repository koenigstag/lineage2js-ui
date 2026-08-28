/**
 * The humanoid bone hierarchy every character in the scene is built on --
 * player and NPC for now (mobs still use the capsule placeholder, see
 * CreatureModel).
 *
 * Kept as plain data, deliberately, rather than baked into the component
 * that draws it. The bones are the part meant to outlive the placeholder:
 * the geometry hanging off them is stand-in art that gets thrown away the
 * day there's something real to render (see TODO.md's "3D models rewrite"),
 * while the rig -- names, parents, rest offsets -- is what an animation
 * clip, an equipment attachment point or an IK pass would address, and what
 * a real skinned model would have to line up with.
 *
 * Units are three.js metres (see utils/coords.ts's L2_TO_THREE_SCALE), Y up,
 * +Z forward, matching the placeholder's own "nose" convention. Offsets are
 * relative to the parent bone, so the whole rig scales by scaling the root.
 *
 * Proportions land on roughly the same silhouette the capsule placeholder
 * had (~1.75m tall, head around y=1.55) so swapping one for the other
 * doesn't move the nickname label or the camera's look-at height.
 */

export interface HumanoidBone {
  name: string;
  /** Parent bone name, or null for the root. */
  parent: string | null;
  /** Offset from the parent bone's origin, in metres. */
  offset: [x: number, y: number, z: number];
  /**
   * Body radius *at this bone*, in metres. The placeholder limb between two
   * bones is a cone frustum running from the parent's radius to the child's,
   * so the surface is continuous across every joint by construction.
   *
   * This is what stops the body reading as a string of beads. Capsules per
   * segment cannot: each one caps both ends with a hemisphere, so every joint
   * gets two overlapping domes, and neighbouring segments with unrelated
   * radii step visibly where they meet.
   */
  radius: number;
  /** Skips the limb into this bone -- for offsets that are structure rather than flesh. */
  noSegment?: boolean;
}

/**
 * Rest pose, parents before children so a single pass can build the tree.
 *
 * Left/right are the character's own: +X is its left, matching three.js's
 * right-handed frame with +Z forward.
 */
export const HUMANOID_RIG: HumanoidBone[] = [
  // Spine. Hips are the root -- everything else hangs off it, and it's the
  // bone a "move the character" transform would drive. Radii swell at the
  // chest and pinch at the waist and neck, which is most of what makes the
  // torso read as a torso.
  { name: "hips", parent: null, offset: [0, 0.92, 0], radius: 0.15 },
  { name: "spine", parent: "hips", offset: [0, 0.17, 0], radius: 0.142 },
  { name: "chest", parent: "spine", offset: [0, 0.19, 0], radius: 0.168 },
  { name: "neck", parent: "chest", offset: [0, 0.15, 0], radius: 0.062 },
  { name: "head", parent: "neck", offset: [0, 0.08, 0], radius: 0.055 },

  // Arms. The shoulder offset is sideways along the collarbone, and drawing
  // flesh along it would give the figure a slab of shoulder -- the deltoid
  // is already covered by the taper from chest radius down to upperArm.
  { name: "shoulder.L", parent: "chest", offset: [0.13, 0.07, 0], radius: 0.062, noSegment: true },
  { name: "upperArm.L", parent: "shoulder.L", offset: [0.05, -0.04, 0], radius: 0.056 },
  { name: "foreArm.L", parent: "upperArm.L", offset: [0, -0.27, 0], radius: 0.045 },
  { name: "hand.L", parent: "foreArm.L", offset: [0, -0.25, 0], radius: 0.038 },
  { name: "fingers.L", parent: "hand.L", offset: [0, -0.09, 0], radius: 0.03 },

  { name: "shoulder.R", parent: "chest", offset: [-0.13, 0.07, 0], radius: 0.062, noSegment: true },
  { name: "upperArm.R", parent: "shoulder.R", offset: [-0.05, -0.04, 0], radius: 0.056 },
  { name: "foreArm.R", parent: "upperArm.R", offset: [0, -0.27, 0], radius: 0.045 },
  { name: "hand.R", parent: "foreArm.R", offset: [0, -0.25, 0], radius: 0.038 },
  { name: "fingers.R", parent: "hand.R", offset: [0, -0.09, 0], radius: 0.03 },

  // Legs. Ankles land at y ~= 0.06 so the feet sit on the ground plane the
  // character's own origin is placed on. The hip sockets are structure, like
  // the shoulders.
  { name: "upperLeg.L", parent: "hips", offset: [0.085, -0.02, 0], radius: 0.098, noSegment: true },
  { name: "lowerLeg.L", parent: "upperLeg.L", offset: [0, -0.42, 0], radius: 0.072 },
  { name: "foot.L", parent: "lowerLeg.L", offset: [0, -0.42, 0], radius: 0.052 },
  { name: "toes.L", parent: "foot.L", offset: [0, -0.05, 0.11], radius: 0.045 },

  { name: "upperLeg.R", parent: "hips", offset: [-0.085, -0.02, 0], radius: 0.098, noSegment: true },
  { name: "lowerLeg.R", parent: "upperLeg.R", offset: [0, -0.42, 0], radius: 0.072 },
  { name: "foot.R", parent: "lowerLeg.R", offset: [0, -0.42, 0], radius: 0.052 },
  { name: "toes.R", parent: "foot.R", offset: [0, -0.05, 0.11], radius: 0.045 },
];

/** Where the head sphere sits and how big it is -- the one piece of the body that isn't a limb segment. */
export const HEAD_RADIUS = 0.108;

/** Heads are taller than they are wide -- a plain sphere reads as a ball on a stick. */
export const HEAD_SCALE: [x: number, y: number, z: number] = [0.92, 1.12, 1];

/** Bone name -> its entry, for callers that pose or attach to a named bone. */
export const HUMANOID_BONES_BY_NAME: ReadonlyMap<string, HumanoidBone> = new Map(
  HUMANOID_RIG.map((bone) => [bone.name, bone])
);

/** Children of each bone, in rig order -- the tree the builder walks. */
export function humanoidChildren(parent: string | null): HumanoidBone[] {
  return HUMANOID_RIG.filter((bone) => bone.parent === parent);
}

/**
 * A pose is bone name -> Euler rotation in radians, applied on top of the
 * rest offsets. Absent bones keep their rest rotation, so a pose only has to
 * name what it actually moves -- which is what an animation clip will
 * produce, and what keeps a standing idle from having to spell out twenty
 * identity rotations.
 */
export type HumanoidPose = Record<string, [x: number, y: number, z: number]>;

/**
 * Default standing pose. The rig's rest offsets put the arms straight down
 * the sides and the legs straight, which reads as a mannequin; a little
 * outward rotation at the shoulders and a slight bend at the elbows is
 * enough to look like a person standing rather than a diagram.
 */
export const HUMANOID_IDLE_POSE: HumanoidPose = {
  // Radians. The rest pose already hangs the arms straight down, so these
  // are small: just enough clearance from the torso, plus a little bend at
  // the elbow so the arm isn't a single rigid stick.
  "upperArm.L": [0, 0, -0.1],
  "foreArm.L": [0.3, 0, -0.05],
  "hand.L": [0.25, 0, 0],
  "upperArm.R": [0, 0, 0.1],
  "foreArm.R": [0.3, 0, 0.05],
  "hand.R": [0.25, 0, 0],
};
