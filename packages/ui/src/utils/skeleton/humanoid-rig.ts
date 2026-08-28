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
   * Placeholder limb drawn from the parent bone to this one -- the segment
   * *ending* at this bone, id est what a real mesh would cover. Drawn inside
   * the parent, so it swings with the parent's rotation. Omitted for bones
   * that are pure attachment points and cover no distance worth filling
   * (hips, shoulders, the sideways offset out to each hip socket).
   */
  thickness?: number;
}

/**
 * Rest pose, parents before children so a single pass can build the tree.
 *
 * Left/right are the character's own: +X is its left, matching three.js's
 * right-handed frame with +Z forward.
 */
export const HUMANOID_RIG: HumanoidBone[] = [
  // Spine. Hips are the root -- everything else hangs off it, and it's the
  // bone a "move the character" transform would drive.
  { name: "hips", parent: null, offset: [0, 0.92, 0] },
  { name: "spine", parent: "hips", offset: [0, 0.18, 0], thickness: 0.15 },
  { name: "chest", parent: "spine", offset: [0, 0.18, 0], thickness: 0.16 },
  { name: "neck", parent: "chest", offset: [0, 0.16, 0], thickness: 0.11 },
  { name: "head", parent: "neck", offset: [0, 0.09, 0], thickness: 0.055 },

  // Arms.
  { name: "shoulder.L", parent: "chest", offset: [0.07, 0.1, 0] },
  { name: "upperArm.L", parent: "shoulder.L", offset: [0.11, 0, 0], thickness: 0.05 },
  { name: "foreArm.L", parent: "upperArm.L", offset: [0, -0.27, 0], thickness: 0.045 },
  { name: "hand.L", parent: "foreArm.L", offset: [0, -0.25, 0], thickness: 0.04 },

  { name: "shoulder.R", parent: "chest", offset: [-0.07, 0.1, 0] },
  { name: "upperArm.R", parent: "shoulder.R", offset: [-0.11, 0, 0], thickness: 0.05 },
  { name: "foreArm.R", parent: "upperArm.R", offset: [0, -0.27, 0], thickness: 0.045 },
  { name: "hand.R", parent: "foreArm.R", offset: [0, -0.25, 0], thickness: 0.04 },

  // Legs. Ankles land at y ~= 0.06 so the feet sit on the ground plane the
  // character's own origin is placed on.
  { name: "upperLeg.L", parent: "hips", offset: [0.09, 0, 0] },
  { name: "lowerLeg.L", parent: "upperLeg.L", offset: [0, -0.44, 0], thickness: 0.07 },
  { name: "foot.L", parent: "lowerLeg.L", offset: [0, -0.42, 0], thickness: 0.06 },
  { name: "toes.L", parent: "foot.L", offset: [0, -0.06, 0.09], thickness: 0.05 },

  { name: "upperLeg.R", parent: "hips", offset: [-0.09, 0, 0] },
  { name: "lowerLeg.R", parent: "upperLeg.R", offset: [0, -0.44, 0], thickness: 0.07 },
  { name: "foot.R", parent: "lowerLeg.R", offset: [0, -0.42, 0], thickness: 0.06 },
  { name: "toes.R", parent: "foot.R", offset: [0, -0.06, 0.09], thickness: 0.05 },
];

/** Where the head sphere sits and how big it is -- the one piece of the body that isn't a limb segment. */
export const HEAD_RADIUS = 0.115;

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
  "upperArm.L": [0, 0, -0.14],
  "foreArm.L": [0.22, 0, -0.06],
  "upperArm.R": [0, 0, 0.14],
  "foreArm.R": [0.22, 0, 0.06],
};
