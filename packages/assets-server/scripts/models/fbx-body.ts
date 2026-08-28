/**
 * Assembles one wearable-free character body out of the separate FBX pieces
 * the Unity project keeps per body part (torso, legs, boots, gloves, face,
 * hair), on a single shared skeleton.
 *
 * Every piece is modelled at the same rest position, so merging them is mostly
 * a matter of re-pointing each piece's skinIndex attribute at one shared bone
 * array and concatenating the geometry. Two exports in the project need more
 * than that and are handled rather than assumed away: one piece ships with no
 * weights at all, and one rig's torso ships a skeleton posed differently from
 * the one its own geometry -- and every one of its animation clips -- is built
 * around.
 */
import fs from "node:fs";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// FBXLoader builds materials eagerly and hands every texture reference to a
// TextureLoader, which needs a DOM to decode an image. Nothing here renders,
// and the pipeline is deliberately geometry-only for now, so hand back an
// empty texture instead of reaching for `document`.
THREE.TextureLoader.prototype.load = function load() {
  return new THREE.Texture() as ReturnType<THREE.TextureLoader["load"]>;
};

/** Which tint each body part is drawn with, since no textures are converted yet. */
export type MaterialSlot = "skin" | "outfit" | "hair";

export interface BodyPart {
  /** Absolute path of the part's .fbx. */
  file: string;
  slot: MaterialSlot;
}

export interface AssembledBody {
  /** Scene root as FBXLoader produced it, with the merged mesh swapped in. */
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  /** Bone names on the assembled rig, for retargeting animation onto it. */
  boneNames: Set<string>;
  /** Height of the assembled body in FBX units, used to scale donor root motion. */
  height: number;
  /** Unity's FBX import scale (`globalScale` in the .fbx.meta) -- the factor that turns the .anim clips' Unity-space translations back into FBX units. */
  unityScale: number;
  /** Pieces whose own skeleton disagreed with the one the body was built on, for the run log. */
  offPose: string[];
}

/** Order matters only for readability: the merged groups are re-sorted by slot. */
export const MATERIAL_SLOTS: MaterialSlot[] = ["skin", "outfit", "hair"];

interface LoadedPiece {
  part: BodyPart;
  root: THREE.Group;
  mesh: THREE.Mesh | THREE.SkinnedMesh;
  /** Null for the handful of pieces the project exported without skinning. */
  skeleton: THREE.Skeleton | null;
  /** Inverse bind matrix by bone name, the fingerprint of the piece's bind pose. */
  binding: Map<string, THREE.Matrix4>;
}

function loadPiece(part: BodyPart): LoadedPiece {
  const buffer = fs.readFileSync(part.file);
  const root = new FBXLoader().parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    ""
  );
  let mesh: THREE.Mesh | null = null;
  root.traverse((object) => {
    const candidate = object as THREE.Mesh;
    // Prefer a skinned mesh, but take a plain one over nothing.
    if (candidate.isMesh && (!mesh || (!(mesh as THREE.SkinnedMesh).isSkinnedMesh && (candidate as THREE.SkinnedMesh).isSkinnedMesh))) {
      mesh = candidate;
    }
  });
  if (!mesh) throw new Error(`No mesh in ${part.file}`);
  root.updateMatrixWorld(true);

  const skinned = mesh as THREE.SkinnedMesh;
  const skeleton = skinned.isSkinnedMesh ? skinned.skeleton : null;
  const binding = new Map<string, THREE.Matrix4>();
  skeleton?.bones.forEach((bone, index) => binding.set(bone.name, skeleton.boneInverses[index]));

  return { part, root, mesh, skeleton, binding };
}

/**
 * How far two inverse bind matrices may drift and still count as the same bind
 * pose. Exports of one pose differ only in the last few digits (worst seen:
 * 2e-3, one face mesh); a genuinely different pose is off by tenths.
 */
const BIND_POSE_EPSILON = 0.01;

function sameBindPose(a: LoadedPiece, b: LoadedPiece): boolean {
  for (const [name, matrix] of a.binding) {
    const other = b.binding.get(name);
    if (!other) continue;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(matrix.elements[i] - other.elements[i]) > BIND_POSE_EPSILON) return false;
    }
  }
  return true;
}

/**
 * Binds an unskinned piece rigidly, one bone per connected shell.
 *
 * `FFighter_m000_b` (boots) is the only piece in the project exported without
 * weights, and dropping it would leave that body barefoot. A boot is a rigid
 * shell that only ever needs to follow one joint, so each shell goes to the
 * bone nearest its centre as a whole -- picking a bone per *vertex* instead
 * splits a boot between the foot and the calf, and the animation then drags it
 * into a spike between the two.
 */
function rigidlyBind(piece: LoadedPiece, bones: THREE.Bone[], bindMatrix: THREE.Matrix4): THREE.BufferGeometry {
  const geometry = piece.mesh.geometry.clone();
  const toBindSpace = new THREE.Matrix4().copy(bindMatrix).invert().multiply(piece.mesh.matrixWorld);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(toBindSpace);

  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const index = geometry.getIndex();
  const count = position.count;

  // The piece's own world space, where it and the skeleton are both still in
  // the bind pose, is where "nearest" means anything.
  const world: THREE.Vector3[] = [];
  const vertex = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    world.push(vertex.fromBufferAttribute(position, i).applyMatrix4(piece.mesh.matrixWorld).clone());
  }

  const parent = new Int32Array(count).map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Exported meshes are un-indexed and duplicate a vertex per triangle corner,
  // so shells only hold together once coincident corners are welded first.
  const atPosition = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const key = `${world[i].x.toFixed(4)},${world[i].y.toFixed(4)},${world[i].z.toFixed(4)}`;
    const first = atPosition.get(key);
    if (first === undefined) atPosition.set(key, i);
    else union(i, first);
  }
  const corners = index ? index.count : count;
  for (let i = 0; i < corners; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    union(a, b);
    union(b, c);
  }

  const shells = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    const shell = shells.get(root);
    if (shell) shell.push(i);
    else shells.set(root, [i]);
  }

  const bonePositions = bones.map((bone) => new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld));
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const centre = new THREE.Vector3();

  for (const shell of shells.values()) {
    centre.set(0, 0, 0);
    for (const i of shell) centre.add(world[i]);
    centre.divideScalar(shell.length);

    let nearest = 0;
    let nearestDistance = Infinity;
    for (let b = 0; b < bonePositions.length; b++) {
      const distance = centre.distanceToSquared(bonePositions[b]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = b;
      }
    }
    for (const i of shell) {
      skinIndex[i * 4] = nearest;
      skinWeight[i * 4] = 1;
    }
  }

  for (let i = 0; i < count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(toBindSpace);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;

  if (normal) {
    for (let i = 0; i < normal.count; i++) {
      vertex.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      normal.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    normal.needsUpdate = true;
  }

  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  return geometry;
}

// What every rig in the Unity project is currently imported at; only used if
// a part ships without its .meta sidecar.
const DEFAULT_UNITY_IMPORT_SCALE = 0.019;

/**
 * Unity's importer rescales an FBX on load, and the `.anim` clips it then
 * writes are in that rescaled space -- so the factor has to come back out of
 * the importer settings, not be guessed from the geometry.
 */
function readUnityImportScale(file: string): number {
  const meta = `${file}.meta`;
  if (!fs.existsSync(meta)) return DEFAULT_UNITY_IMPORT_SCALE;
  const match = /^\s+globalScale: (\S+)$/m.exec(fs.readFileSync(meta, "utf8"));
  return match ? Number(match[1]) : DEFAULT_UNITY_IMPORT_SCALE;
}

/**
 * The largest group of pieces whose skeletons agree, richest skeleton first.
 *
 * This is what the body's bones come from, and it matters because the
 * animation clips are authored against one specific pose -- driving a skeleton
 * posed differently with them folds the character up. `MDarkElf_m000_u` ships
 * exactly that: a skeleton up to 98 degrees off at a joint from the one its
 * own five sibling pieces (and all of its clips) use. Its *geometry* sits at
 * the same rest position as theirs, so it merges in untouched; only its bones
 * have to lose the vote.
 *
 * Ordering matters too, since an FBX skinned mesh only carries the bones that
 * actually influence it -- a legs mesh has no arm bones -- so the richest
 * skeleton first means fewer bones have to be adopted from a losing piece.
 */
function bindPoseCluster(pieces: LoadedPiece[]): LoadedPiece[] {
  const skinned = pieces.filter((piece) => piece.skeleton);
  if (skinned.length === 0) throw new Error(`No skinned piece to build a body on (${pieces[0]?.part.file})`);

  let best: LoadedPiece[] = [];
  for (const candidate of skinned) {
    const agreeing = skinned.filter((other) => sameBindPose(candidate, other));
    if (agreeing.length > best.length) best = agreeing;
  }
  return best.sort((a, b) => b.skeleton!.bones.length - a.skeleton!.bones.length);
}

export function assembleBody(parts: BodyPart[]): AssembledBody {
  if (parts.length === 0) throw new Error("No body parts to assemble");

  const pieces = parts.map(loadPiece);
  const cluster = bindPoseCluster(pieces);
  const primaryPiece = cluster[0];
  const primary = primaryPiece.mesh as THREE.SkinnedMesh;
  const bindMatrix = primary.bindMatrix;

  // The union of every piece's bones. Pieces mostly share one rig, but a few
  // carry extra joints of their own (hair strands on the elf and dark elf
  // females), and those have to join the skeleton rather than be collapsed
  // onto a neighbour -- appending keeps the indices handed out earlier valid.
  const bones = [...primaryPiece.skeleton!.bones];
  const boneInverses = [...primaryPiece.skeleton!.boneInverses];
  const boneIndexByName = new Map(bones.map((bone, index) => [bone.name, index]));
  const primaryRootBone = bones.find((bone) => !(bone.parent as THREE.Bone | null)?.isBone) ?? bones[0];

  function adoptBone(pieceBone: THREE.Bone, piece: LoadedPiece): number {
    const existing = boneIndexByName.get(pieceBone.name);
    if (existing !== undefined) return existing;

    const pieceParent = pieceBone.parent as THREE.Bone | null;
    const parent = pieceParent?.isBone ? bones[adoptBone(pieceParent, piece)] : primaryRootBone;

    const adopted = pieceBone.clone(false);
    parent.add(adopted);
    adopted.updateMatrixWorld(true);

    bones.push(adopted);
    // Derived from where the bone actually lands in the assembled hierarchy,
    // not copied from the piece -- the piece may be on a bind pose this body
    // isn't using.
    boneInverses.push(new THREE.Matrix4().copy(adopted.matrixWorld).invert());
    boneIndexByName.set(adopted.name, bones.length - 1);
    return bones.length - 1;
  }

  // Fill the skeleton out from the agreed-pose pieces before touching anything
  // else, so no bone is adopted from a piece on a different pose while a piece
  // on the right one also has it.
  for (const piece of cluster) piece.skeleton!.bones.forEach((bone) => adoptBone(bone, piece));

  const geometries: THREE.BufferGeometry[] = [];
  const slots: MaterialSlot[] = [];
  const offPose: string[] = [];

  for (const piece of pieces) {
    let geometry: THREE.BufferGeometry;

    if (piece.skeleton) {
      // Every piece is exported at the same 100x axis-conversion scale, so a
      // mismatch here is something this merge has no way to reconcile.
      const pieceBind = (piece.mesh as THREE.SkinnedMesh).bindMatrix;
      if (pieceBind.elements.some((value, i) => Math.abs(value - bindMatrix.elements[i]) > BIND_POSE_EPSILON)) {
        throw new Error(`${piece.part.file}: mesh bind matrix differs from ${primaryPiece.part.file}`);
      }

      geometry = piece.mesh.geometry.clone();
      piece.skeleton.bones.forEach((bone) => adoptBone(bone, piece));
      if (!sameBindPose(piece, primaryPiece)) offPose.push(piece.part.file.split("/").pop()!);

      // Re-point skinIndex at the shared bone array. Identical rigs usually come
      // out in the same order anyway, but nothing guarantees that per export, and
      // a silently mismatched index is a limb attached to the wrong joint.
      const remap = piece.skeleton.bones.map((bone) => boneIndexByName.get(bone.name)!);
      const skinIndex = (geometry.getAttribute("skinIndex") as THREE.BufferAttribute).array;
      for (let i = 0; i < skinIndex.length; i++) skinIndex[i] = remap[skinIndex[i]];
    } else {
      geometry = rigidlyBind(piece, bones, bindMatrix);
    }

    // mergeGeometries insists on identical attribute sets; drop anything the
    // pipeline doesn't use rather than requiring every part to carry it.
    for (const name of Object.keys(geometry.attributes)) {
      if (!["position", "normal", "uv", "skinIndex", "skinWeight"].includes(name)) {
        geometry.deleteAttribute(name);
      }
    }

    geometries.push(geometry);
    slots.push(piece.part.slot);
  }

  // Merge per tint slot first, then merge the slots with groups: glTF turns
  // every group into its own primitive, so collapsing here is the difference
  // between three draw calls per character and one per body part.
  const slotGeometries = MATERIAL_SLOTS.map((slot) => {
    const forSlot = geometries.filter((_, index) => slots[index] === slot);
    return forSlot.length > 0 ? mergeGeometries(forSlot, false) : null;
  }).filter((geometry): geometry is THREE.BufferGeometry => geometry !== null);

  const merged = mergeGeometries(slotGeometries, true);
  if (!merged) throw new Error("Body parts have incompatible geometry attributes");

  primary.geometry = merged;
  // Rebind, since adopted bones changed the array the skin indices point into.
  primary.bind(new THREE.Skeleton(bones, boneInverses), bindMatrix);
  // Placeholder tones -- the runtime overrides every slot per character
  // variant, and real textures aren't converted yet.
  primary.material = MATERIAL_SLOTS.map(
    (slot) => new THREE.MeshStandardMaterial({ name: slot, color: 0xffffff, roughness: 0.75 })
  );
  primary.name = "body";

  primaryPiece.root.updateMatrixWorld(true);
  // A skinned mesh measures itself through its bones, which stay stale until
  // the skeleton is refreshed -- and the bones are at bind pose, so this is the
  // rest-pose height.
  primary.skeleton.update();
  const box = new THREE.Box3().setFromObject(primaryPiece.root);

  return {
    root: primaryPiece.root,
    mesh: primary,
    boneNames: new Set(boneIndexByName.keys()),
    height: box.max.y - box.min.y,
    unityScale: readUnityImportScale(primaryPiece.part.file),
    offPose,
  };
}
