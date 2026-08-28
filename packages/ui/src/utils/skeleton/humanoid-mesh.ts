import {
  BufferAttribute,
  BufferGeometry,
  Bone,
  Color,
  Matrix4,
  Skeleton,
  Vector3,
} from "three";
import { HEAD_RADIUS, HEAD_SCALE, HUMANOID_RIG, type HumanoidBone } from "./humanoid-rig";

/**
 * Builds a single skinned body mesh over the humanoid rig -- one continuous
 * surface bound to the bones, rather than a separate lump of geometry parented
 * to each one.
 *
 * That distinction is the whole point. Rigid per-bone pieces cannot bend: at
 * every joint one piece ends and the next begins, so posing the rig opens a
 * gap on the outside of the elbow and drives one piece through the other on
 * the inside. A skinned vertex is instead influenced by several bones at once,
 * so the surface stretches around a joint the way skin does, and a walk cycle
 * won't tear the model apart.
 *
 * Everything here is generated from the rig's own numbers -- no art, no
 * asset files. It's a stand-in body of the right shape and topology, and the
 * thing it's really providing is a correct skinned setup for the day real
 * geometry replaces it.
 */

/** Rings of vertices generated along each bone segment. More rings bend more smoothly and cost more vertices. */
const RINGS_PER_SEGMENT = 4;
/** Vertices around each ring. */
const RADIAL_SEGMENTS = 12;

/**
 * Chains of bones meshed as one continuous tube each. Built per limb rather
 * than as one branching surface: a proper branching tube around the shoulders
 * and hips is a genuinely hard piece of geometry, while overlapping tubes at
 * those two places are invisible once the radii are sensible -- which is how
 * most low-poly characters are actually put together.
 */
const MESH_CHAINS: string[][] = [
  ["hips", "spine", "chest", "neck", "head"],
  ["chest", "upperArm.L", "foreArm.L", "hand.L", "fingers.L"],
  ["chest", "upperArm.R", "foreArm.R", "hand.R", "fingers.R"],
  ["hips", "lowerLeg.L", "foot.L", "toes.L"],
  ["hips", "lowerLeg.R", "foot.R", "toes.R"],
];

/** Bones whose end of the chain gets closed off with a ball, so the tube isn't left open. */
const CAPPED_BONES = new Set(["head", "fingers.L", "fingers.R", "toes.L", "toes.R", "hips"]);

/** Skin-coloured, rather than the outfit's tint. */
function isSkin(boneName: string): boolean {
  return boneName === "head" || boneName.startsWith("hand.") || boneName.startsWith("fingers.");
}

export interface HumanoidSkeleton {
  root: Bone;
  bones: Bone[];
  boneByName: Map<string, Bone>;
  boneIndex: Map<string, number>;
}

/** Builds the THREE.Bone tree in the rig's rest pose -- the pose the mesh below is bound in. */
export function buildHumanoidSkeleton(): HumanoidSkeleton {
  const boneByName = new Map<string, Bone>();
  const bones: Bone[] = [];
  const boneIndex = new Map<string, number>();

  for (const definition of HUMANOID_RIG) {
    const bone = new Bone();
    bone.name = definition.name;
    bone.position.set(...definition.offset);
    boneIndex.set(definition.name, bones.length);
    boneByName.set(definition.name, bone);
    bones.push(bone);
  }

  let root: Bone | undefined;
  for (const definition of HUMANOID_RIG) {
    const bone = boneByName.get(definition.name)!;
    if (definition.parent === null) {
      root = bone;
    } else {
      boneByName.get(definition.parent)!.add(bone);
    }
  }
  if (!root) {
    throw new Error("Humanoid rig has no root bone");
  }

  root.updateMatrixWorld(true);
  return { root, bones, boneByName, boneIndex };
}

/** Rest-pose world position of every bone, which is the space the geometry is authored in. */
function restPositions(skeleton: HumanoidSkeleton): Map<string, Vector3> {
  const positions = new Map<string, Vector3>();
  for (const bone of skeleton.bones) {
    positions.set(bone.name, new Vector3().setFromMatrixPosition(bone.matrixWorld));
  }
  return positions;
}

const RIG_BY_NAME = new Map(HUMANOID_RIG.map((bone) => [bone.name, bone]));

function definitionOf(name: string): HumanoidBone {
  const definition = RIG_BY_NAME.get(name);
  if (!definition) {
    throw new Error(`Unknown bone "${name}" in a mesh chain`);
  }
  return definition;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface Builder {
  positions: number[];
  colors: number[];
  skinIndices: number[];
  skinWeights: number[];
  indices: number[];
}

/**
 * Emits one ring of vertices around `center`, facing `direction`.
 *
 * Weights blend toward the neighbouring bone only near the joints (see the
 * smoothsteps below): a vertex halfway down the forearm belongs entirely to
 * the forearm, and only the ones close to the elbow are shared 50/50 with the
 * upper arm. Blending linearly along the whole segment instead is what makes
 * a limb bend like rubber rather than like an arm.
 */
function emitRing(
  builder: Builder,
  center: Vector3,
  direction: Vector3,
  radius: number,
  weights: [index: number, weight: number][],
  color: Color
): number {
  const first = builder.positions.length / 3;

  // Any two axes perpendicular to the segment will do -- the ring is round,
  // so where it "starts" is arbitrary; it only has to be consistent.
  const up = Math.abs(direction.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const sideways = new Vector3().crossVectors(direction, up).normalize();
  const forward = new Vector3().crossVectors(sideways, direction).normalize();

  for (let i = 0; i < RADIAL_SEGMENTS; i++) {
    const angle = (i / RADIAL_SEGMENTS) * Math.PI * 2;
    const point = center
      .clone()
      .addScaledVector(sideways, Math.cos(angle) * radius)
      .addScaledVector(forward, Math.sin(angle) * radius);
    builder.positions.push(point.x, point.y, point.z);
    builder.colors.push(color.r, color.g, color.b);

    for (let slot = 0; slot < 4; slot++) {
      builder.skinIndices.push(weights[slot]?.[0] ?? 0);
      builder.skinWeights.push(weights[slot]?.[1] ?? 0);
    }
  }

  return first;
}

/** Joins two rings of the same radial resolution into a band of triangles. */
function bridgeRings(builder: Builder, ringA: number, ringB: number): void {
  for (let i = 0; i < RADIAL_SEGMENTS; i++) {
    const next = (i + 1) % RADIAL_SEGMENTS;
    builder.indices.push(ringA + i, ringB + i, ringA + next);
    builder.indices.push(ringA + next, ringB + i, ringB + next);
  }
}

/** Closes the end of a tube with a ball, so a hand or a foot isn't a hollow pipe. */
function emitCap(
  builder: Builder,
  center: Vector3,
  radius: number,
  boneIdx: number,
  color: Color,
  scale: [number, number, number] = [1, 1, 1]
): void {
  const rings = 6;
  const first = builder.positions.length / 3;

  for (let ring = 0; ring <= rings; ring++) {
    const phi = (ring / rings) * Math.PI;
    for (let i = 0; i < RADIAL_SEGMENTS; i++) {
      const theta = (i / RADIAL_SEGMENTS) * Math.PI * 2;
      builder.positions.push(
        center.x + Math.sin(phi) * Math.cos(theta) * radius * scale[0],
        center.y + Math.cos(phi) * radius * scale[1],
        center.z + Math.sin(phi) * Math.sin(theta) * radius * scale[2]
      );
      builder.colors.push(color.r, color.g, color.b);
      builder.skinIndices.push(boneIdx, 0, 0, 0);
      builder.skinWeights.push(1, 0, 0, 0);
    }
  }

  for (let ring = 0; ring < rings; ring++) {
    for (let i = 0; i < RADIAL_SEGMENTS; i++) {
      const next = (i + 1) % RADIAL_SEGMENTS;
      const a = first + ring * RADIAL_SEGMENTS + i;
      const b = first + ring * RADIAL_SEGMENTS + next;
      const c = first + (ring + 1) * RADIAL_SEGMENTS + i;
      const d = first + (ring + 1) * RADIAL_SEGMENTS + next;
      builder.indices.push(a, c, b, b, c, d);
    }
  }
}

/**
 * Generates the whole body as one geometry, in the rig's rest pose, with the
 * skin attributes a SkinnedMesh needs.
 */
export function buildHumanoidGeometry(skeleton: HumanoidSkeleton, outfitColor: string, skinColor: string): BufferGeometry {
  const rest = restPositions(skeleton);
  const outfit = new Color(outfitColor);
  const skin = new Color(skinColor);
  const builder: Builder = { positions: [], colors: [], skinIndices: [], skinWeights: [], indices: [] };

  for (const chain of MESH_CHAINS) {
    let previousRing: number | undefined;

    for (let link = 0; link < chain.length - 1; link++) {
      const fromName = chain[link];
      const toName = chain[link + 1];
      const from = rest.get(fromName)!;
      const to = rest.get(toName)!;
      const direction = to.clone().sub(from);
      if (direction.lengthSq() === 0) {
        continue;
      }
      direction.normalize();

      const fromIdx = skeleton.boneIndex.get(fromName)!;
      const toIdx = skeleton.boneIndex.get(toName)!;
      const fromRadius = definitionOf(fromName).radius;
      const toRadius = definitionOf(toName).radius;
      const color = isSkin(toName) ? skin : outfit;

      for (let step = 0; step <= RINGS_PER_SEGMENT; step++) {
        const t = step / RINGS_PER_SEGMENT;
        // Skip the seam ring: the previous segment already emitted a ring at
        // this exact position, and bridging to it keeps the surface closed.
        if (step === 0 && previousRing !== undefined) {
          continue;
        }

        const center = from.clone().lerp(to, t);
        const radius = fromRadius + (toRadius - fromRadius) * t;
        // 50/50 at the joint, entirely one bone through the middle.
        const share = 0.5 * smoothstep(0.55, 1, t);
        const ring = emitRing(
          builder,
          center,
          direction,
          radius,
          [
            [fromIdx, 1 - share],
            [toIdx, share],
          ],
          color
        );

        if (previousRing !== undefined) {
          bridgeRings(builder, previousRing, ring);
        }
        previousRing = ring;
      }
    }
  }

  for (const name of CAPPED_BONES) {
    const definition = definitionOf(name);
    const center = rest.get(name)!;
    const boneIdx = skeleton.boneIndex.get(name)!;
    const color = isSkin(name) ? skin : outfit;

    if (name === "head") {
      // The head is the one part with a shape of its own rather than a
      // rounded-off limb end.
      emitCap(builder, center.clone().add(new Vector3(0, HEAD_RADIUS * HEAD_SCALE[1] * 0.85, 0)), HEAD_RADIUS, boneIdx, color, HEAD_SCALE);
    } else {
      emitCap(builder, center, definition.radius, boneIdx, color);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(builder.positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(builder.colors), 3));
  geometry.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(builder.skinIndices), 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(new Float32Array(builder.skinWeights), 4));
  geometry.setIndex(builder.indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The Skeleton a SkinnedMesh binds to. Bind matrices come from the rest pose the geometry was authored in. */
export function buildSkeletonBinding(skeleton: HumanoidSkeleton): Skeleton {
  return new Skeleton(skeleton.bones, skeleton.bones.map((bone) => new Matrix4().copy(bone.matrixWorld).invert()));
}
