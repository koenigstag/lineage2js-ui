/**
 * Builds every playable character body straight out of an installed Lineage 2
 * client: sixteen `<rig>.glb` files, one per race and sex, plus the textures
 * that go on them.
 *
 * It began as a second pipeline beside convert-unity-models.ts, which built
 * ten of them from a Unity port of the same client and had no orcs or Kamael
 * at all. Converting those ten from the client too settled two things at
 * once: the port had been faithful (the human fighter comes out to the same
 * height and head position, to three decimals) but it had lost the smoothing
 * groups, and it could not be textured, because it merged each body into one
 * mesh while the client keeps a texture per body part.
 *
 * What this reads: the client's own packages through UE Viewer
 * (https://www.gildor.org) -- body pieces as glTF, animations as PSA,
 * textures as PNG.
 *
 * One thing it gets for free that the Unity path had to reconstruct: clip
 * timing. Every PSA sequence carries its own frame count and rate, so a clip
 * comes out at the duration the client authored it for. The Unity path lost
 * that (everything flattened onto 24fps) and has a measured table to put it
 * back -- see AUTHORED_SECONDS over there.
 *
 * The output is derived from NCsoft's copyrighted client art and must never
 * be committed; it lands under assets/, covered by its blanket .gitignore.
 *
 * Run with:
 *   pnpm --filter @lineage2js/assets-server convert:client-rigs -- \
 *     --client="D:\Games\Lineage2\L2_HighFive_Client" --umodel="C:\ue_viewer\umodel_64.exe"
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { readPsa, toThreeClip, type PsaFile, type PsaSequence } from "./models/psa-anim";
import { bareBodies, readArmorgrp, splitObjectName, type ArmorBody, type ArmorSlot } from "./client-data/armorgrp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/highfive/models");
const OUT_TEXTURE_DIR = path.join(__dirname, "../assets/highfive/textures");

// See convert-unity-models.ts for why the exporter needs this in node.
(globalThis as { FileReader?: unknown }).FileReader ??= class {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

/** The topmost bone of every player rig -- 3ds Max biped naming, shared with the Unity-derived ten. */
const ROOT_BONE = "bip01";

/**
 * umodel's glTF export is 1/100th of the client's own units, while the
 * Unity-derived rigs are in those units directly (a human comes out ~44 units
 * tall, which is what the web client's single CHARACTER_MODEL_SCALE expects).
 * Undoing that keeps one constant working for bodies from either pipeline --
 * and keeps an orc taller than a dwarf instead of normalising each rig to the
 * same height.
 */
const UNIT_SCALE = 100;

const IDENTITY = new THREE.Matrix4();

/**
 * A piece's skeleton boiled down to a string, so two of them can be compared.
 *
 * Pieces of one rig normally share a rest pose exactly, and the merge relies
 * on it: geometry is taken as it comes and bound to whichever skeleton leads,
 * so a piece skinned against a different rest pose lands crooked. They are
 * not always the same, though -- the male dark elf's torso is published in a
 * pose of its own, a few centimetres off every other piece of him.
 */
function skeletonFingerprint(group: THREE.Group): string {
  let mesh: THREE.SkinnedMesh | null = null;
  group.traverse((object) => {
    if (!mesh && (object as THREE.SkinnedMesh).isSkinnedMesh) mesh = object as THREE.SkinnedMesh;
  });
  if (!mesh) return "";
  group.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  // Sorted, because a skin lists its joints in whatever order it uses them
  // and two pieces of one rig routinely disagree about that while sharing the
  // pose exactly. Only where a joint rests should count here.
  return (mesh as THREE.SkinnedMesh).skeleton.bones
    .map((bone) => {
      position.setFromMatrixPosition(bone.matrixWorld);
      return `${bone.name}:${position.x.toFixed(3)},${position.y.toFixed(3)},${position.z.toFixed(3)}`;
    })
    .sort()
    .join("|");
}

/** Nearest joint to a point, for placing a piece that arrived without one of its own. */
function nearestBone(bones: THREE.Bone[], point: THREE.Vector3): THREE.Bone {
  const position = new THREE.Vector3();
  let nearest = bones[0];
  let shortest = Infinity;
  for (const bone of bones) {
    const distance = position.setFromMatrixPosition(bone.matrixWorld).distanceTo(point);
    if (distance < shortest) {
      shortest = distance;
      nearest = bone;
    }
  }
  return nearest;
}

/**
 * The parts a body is built from, which is also how the client textures it:
 * one texture per part per rig. That is why each part stays its own primitive
 * with a material of its own, instead of the handful of tint groups this used
 * to merge down to -- a part cannot share a draw call with one that has a
 * different texture.
 */
type BodyPart = "face" | "hair" | "upper" | "lower" | "boots" | "gloves" | "wing";

/** Merge order, nothing more; a rig with no piece for a part gets no primitive for it. */
const BODY_PARTS: BodyPart[] = ["face", "hair", "upper", "lower", "boots", "gloves", "wing"];

/**
 * What a piece's material is called, which is also how the runtime finds its
 * texture and, for hair, which of them to draw.
 *
 * Every part but hair has exactly one mesh, so its name is the part. Hair
 * does not: the client ships two head meshes per rig -- `m00_bh` and
 * `m00_ah` -- and character creation picks between them. Both are converted
 * and both are merged in, each as its own primitive, so the runtime can show
 * one and hide the other without reloading the body.
 */
function slotName(part: BodyPart, style = 0): string {
  return part === "hair" ? `hair-${style}` : part;
}

interface PieceSource {
  /** Suffix after the rig name, e.g. "m000_f" -- for a piece that lives in one set. */
  suffix?: string;
  /**
   * A body part, named by its letter alone: which set it comes from differs by
   * rig and is read off the textures rather than fixed here -- see bodySet.
   */
  bodyPart?: "u" | "l" | "b" | "g";
  /** What it is, which decides both its material and the texture that goes on it. */
  part: BodyPart;
  /**
   * Marks a piece as one of several the player chooses between, rather than
   * one more piece of the same body -- hair, and only hair. Declared order is
   * the offering order; the index a piece actually gets is assigned after the
   * export, so a rig that ships fewer of them (the orcs have no `ah` head)
   * still numbers its own from zero.
   */
  choice?: boolean;
  /**
   * Build the body on this piece's skeleton. Defaults to the rig's own first
   * piece, which is right whenever the rig has a body of its own; a body
   * borrowed from another rig has to lead instead, because it is the one part
   * whose skinning has to stay exact -- see FShaman.
   */
  primary?: boolean;
  /** Package and rig to take it from -- not always this rig's own, see FShaman. */
  from?: { pkg: string; rig: string };
}

interface ClientRig {
  /** Output name, matching what config/character-models.ts asks for. */
  rig: string;
  /** Package holding its meshes and animations, e.g. "Orc" for Animations/Orc.ukx. */
  pkg: string;
  /** MeshAnimation object with its sequences. */
  animObject: string;
  /**
   * Further MeshAnimation objects covering pieces that move on a skeleton of
   * their own, whose sequences are named exactly like the body's -- the
   * client plays them alongside it, and so does this, by merging their tracks
   * into the clip of the same name.
   */
  extraAnimObjects?: string[];
  /** Replaces BODY_PIECES outright, for a body assembled from more than one package -- see FShaman. */
  pieces?: PieceSource[];
  /** Added on top of whichever list applies, for a part only this rig has. */
  extraPieces?: PieceSource[];
}

/** The pieces a body is made of, in the same slots the Unity path uses. */
/**
 * The body a character wears with nothing equipped is the m001 set, not m000:
 * one mesh per part, textured t02 for bare skin and t01 for the squire's
 * shirt a character can be given. m000 exists beside it with textures of its
 * own (t1000) and is not what the game shows -- taking it dressed the female
 * dark elf in underwear she does not have, and left the Kamael untextured
 * altogether, since m000 has no body textures for them at all.
 *
 * The face, the hair and the Kamael wing are not part of that: they stay in
 * m000, where the client keeps them.
 */
const BODY_PIECES: PieceSource[] = [
  { bodyPart: "u", part: "upper" },
  { bodyPart: "l", part: "lower" },
  { bodyPart: "b", part: "boots" },
  { bodyPart: "g", part: "gloves" },
  { suffix: "m000_f", part: "face" },
  { suffix: "m000_m00_bh", part: "hair", choice: true },
  { suffix: "m000_m00_ah", part: "hair", choice: true },
];

/**
 * The Kamael wing -- one of them, which is not an export that lost half of
 * itself. Every vertex of the mesh sits to one side of centre while the torso
 * beside it is symmetric, because a Kamael has a single wing; the second one
 * seen on later characters is cloth and comes with an armour set, not with
 * the body. So this is never mirrored.
 *
 * m000 is the starting set, which is the only one this pipeline converts.
 */
const WING: PieceSource[] = [{ suffix: "m000_w_ad00", part: "wing" }];

const RIGS: ClientRig[] = [
  // Every one of these came from the Unity project before (see
  // convert-unity-models.ts), as a single mesh with no textures. The client
  // has them all, split into the same parts as the orcs and with the same
  // three faces and four hair colours, so they are converted from it now and
  // the Unity path no longer has a rig to itself.
  { rig: "MFighter", pkg: "Fighter", animObject: "MFighter_anim" },
  { rig: "FFighter", pkg: "Fighter", animObject: "FFighter_anim" },
  { rig: "MMagic", pkg: "Magic", animObject: "MMagic_anim" },
  { rig: "FMagic", pkg: "Magic", animObject: "FMagic_anim" },
  { rig: "MElf", pkg: "Elf", animObject: "MElf_anim" },
  { rig: "FElf", pkg: "Elf", animObject: "FElf_anim" },
  { rig: "MDarkElf", pkg: "DarkElf", animObject: "MDarkElf_anim" },
  { rig: "FDarkElf", pkg: "DarkElf", animObject: "FDarkElf_anim" },
  { rig: "MDwarf", pkg: "Dwarf", animObject: "MDwarf_anim" },
  { rig: "FDwarf", pkg: "Dwarf", animObject: "FDwarf_anim" },

  { rig: "MOrc", pkg: "Orc", animObject: "MOrc_anim" },
  { rig: "FOrc", pkg: "Orc", animObject: "FOrc_anim" },
  { rig: "MShaman", pkg: "Shaman", animObject: "MShaman_anim" },
  // The female orc mystic is the female orc from the neck down -- the Shaman
  // package ships her face and hair and nothing else, so the body comes from
  // FOrc, and leads, so that the skinning of the part with the most of it
  // keeps the rest pose it was weighted against.
  //
  // Her face is hers: a different mesh from FOrc's (234 vs 236 vertices), and
  // the package has the three textures to go with it. Her hairstyle is not,
  // though it is also a mesh of her own -- the package ships no texture for
  // it, and there is nothing to fall back on, since the _bh textures beside
  // it are cut for a different mesh and would land on hers with the wrong
  // UVs. FOrc's hair comes with FOrc's, and a hairstyle is not what tells a
  // mystic apart.
  {
    rig: "FShaman",
    pkg: "Shaman",
    animObject: "FShaman_anim",
    pieces: [
      { bodyPart: "u", part: "upper", from: { pkg: "Orc", rig: "FOrc" }, primary: true },
      { bodyPart: "l", part: "lower", from: { pkg: "Orc", rig: "FOrc" } },
      { bodyPart: "b", part: "boots", from: { pkg: "Orc", rig: "FOrc" } },
      { bodyPart: "g", part: "gloves", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_f", part: "face" },
      { suffix: "m000_m00_bh", part: "hair", from: { pkg: "Orc", rig: "FOrc" } },
    ],
  },
  // Wings are a Kamael part and nothing else has one. They come as a mesh
  // with an eighteen-joint skeleton of its own (Main_wing and Bone13..Bone46,
  // sharing no name with the body), which is why assemble() has to work out
  // where a foreign skeleton attaches -- see adoptBone.
  // The wing has both a skeleton and an animation set of its own, sequence
  // for sequence with the body's. Without them it stays in its reference
  // pose, which is spread wide open -- in the game a Kamael standing still
  // wears it folded down the back.
  {
    rig: "MKamael",
    pkg: "Kamael",
    animObject: "MKamael_anim",
    extraAnimObjects: ["Wing_MKamael"],
    extraPieces: WING,
  },
  {
    rig: "FKamael",
    pkg: "Kamael",
    animObject: "FKamael_anim",
    extraAnimObjects: ["Wing_FKamael"],
    extraPieces: WING,
  },
];

/**
 * Clip name in the output -> the client sequence it comes from, without the
 * trailing rig name. Same set the Unity path exports, so a body from either
 * answers to the same states (see CreatureModel's animationFor).
 */
const CLIPS: { name: string; candidates: string[]; inPlace?: boolean }[] = [
  { name: "idle", candidates: ["Wait_Hand"] },
  { name: "walk", candidates: ["Walk_Hand"], inPlace: true },
  { name: "run", candidates: ["Run_Hand"], inPlace: true },
  { name: "sit", candidates: ["Sit"] },
  { name: "sitIdle", candidates: ["SitWait"] },
  { name: "stand", candidates: ["Stand"] },
  { name: "attack", candidates: ["Atk01_Hand"] },
  { name: "attack1hs", candidates: ["Atk01_1HS"] },
  { name: "attackDual", candidates: ["Atk01_Dual"] },
  { name: "attackDualDagger", candidates: ["Atk01_Dual_Dagger"] },
  { name: "attackBow", candidates: ["Atk01_Bow"] },
  { name: "attackPole", candidates: ["Atk01_Pole"] },
  // Kamael are the only bodies in the game that know this one, rapiers being
  // theirs -- every other rig falls back to the plain swing, which is what
  // the web client already does for a weapon class it has no motion for.
  { name: "attackRapier", candidates: ["Atk01_Rapier"] },
  // The Kamael rigs spell it PickItem where every older one says PicItem.
  { name: "pickup", candidates: ["PicItem", "PickItem"] },
  { name: "cast", candidates: ["CastMid"] },
  { name: "death", candidates: ["Death"] },
];

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

function runUmodel(umodel: string, client: string, args: string[]): void {
  const result = spawnSync(umodel, [`-path=${client}`, "-game=l2", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`umodel failed (exit ${result.status}):\n${result.stderr || result.stdout}`);
  }
}

/**
 * umodel writes .gltf next to a separate .bin, which GLTFLoader can only
 * follow over a URL. Repacking the pair as one in-memory GLB sidesteps that
 * entirely -- a binary glTF carries its buffer inside it, so the parse needs
 * no file access at all.
 */
function packGlb(gltfFile: string): ArrayBuffer {
  const json = JSON.parse(fs.readFileSync(gltfFile, "utf8")) as { buffers?: { uri?: string; byteLength: number }[] };
  const binFile = path.join(path.dirname(gltfFile), path.basename(gltfFile, ".gltf") + ".bin");
  const bin = fs.readFileSync(binFile);
  if (json.buffers?.[0]) delete json.buffers[0].uri;

  const pad = (length: number, to = 4) => (to - (length % to)) % to;
  const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([jsonBuffer, Buffer.alloc(pad(jsonBuffer.length), 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc(pad(bin.length), 0)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // "BIN"

  const glb = Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
}

async function loadPiece(gltfFile: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const glb = packGlb(gltfFile);
  const gltf = await loader.parseAsync(glb, "");
  return gltf.scene;
}

interface AssembledBody {
  root: THREE.Group;
  boneNames: Set<string>;
  /** Bounding-box height in client units, for the log -- an orc should read taller than a dwarf. */
  height: number;
  /** Joints no body piece had, taken from a hairstyle -- reported so a surprise shows up in the run. */
  adopted: string[];
  /** Pieces that arrived unskinned and were bound to a joint, as "piece -> bone". */
  reattached: string[];
  /** Pieces moved onto this skeleton from another rig's, as "piece by distance". */
  aligned: string[];
}

/**
 * The joint a piece hangs off, for a piece that isn't skinned at all.
 *
 * Not every part of a body is weighted. The orc and shaman faces -- and one
 * of their two hairstyles -- put a single full weight on the skeleton's root
 * on every vertex, which is how the client stores a mesh it attaches to a
 * joint at runtime instead of skinning it. Merged as they come, they hang off
 * the pelvis: upright and roughly in the right place, but turning with the
 * hips rather than the head. (The Kamael package needs none of this -- its
 * faces and hair are weighted to the head like everything else.)
 *
 * Which joint is recorded nowhere in the export, so it comes from the
 * geometry: a rigid part rests on the joint that carries it, so the bone
 * nearest to where it sits in the reference pose is the one. Re-pointing the
 * skin index is the whole fix -- in the reference pose a bone's matrix and
 * its inverse cancel, so the piece does not move, it only starts following.
 *
 * Returns null for a piece that is genuinely skinned, which is most of them.
 */
function rigidAttachment(mesh: THREE.SkinnedMesh): { root: number; bone: THREE.Bone } | null {
  const bones = mesh.skeleton.bones;
  const root = bones.findIndex((bone) => !(bone.parent as THREE.Bone | null)?.isBone);
  if (root < 0) return null;

  const skinIndex = mesh.geometry.getAttribute("skinIndex") as THREE.BufferAttribute;
  const skinWeight = mesh.geometry.getAttribute("skinWeight") as THREE.BufferAttribute;
  for (let vertex = 0; vertex < skinIndex.count; vertex++) {
    for (let influence = 0; influence < 4; influence++) {
      if (skinWeight.getComponent(vertex, influence) === 0) continue;
      if (skinIndex.getComponent(vertex, influence) !== root) return null;
    }
  }

  mesh.geometry.computeBoundingBox();
  const centre = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
  mesh.localToWorld(centre);
  return { root, bone: nearestBone(bones, centre) };
}

/**
 * All of a rig's pieces on one skeleton. Unlike the FBX path this needs no
 * bind-pose reconciliation: every piece umodel exports for a rig carries the
 * same skeleton, bone for bone and transform for transform (checked across
 * pieces before this pipeline was written), so the first piece's skeleton is
 * the rig's and the rest contribute only their meshes.
 */
function assemble(
  pieces: { group: THREE.Group; slot: string; name: string }[],
  selfAnimated: Set<string>
): AssembledBody {
  // All of them, not just the first: a piece whose mesh has more than one
  // material arrives from GLTFLoader as a group of that many skinned meshes
  // (the Kamael torso is two), and taking one would leave the rest in the
  // tree unmerged -- exported as a second body with its own skeleton and
  // none of the tint materials.
  const meshesOf = (group: THREE.Group): THREE.SkinnedMesh[] => {
    const found: THREE.SkinnedMesh[] = [];
    group.traverse((object) => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) found.push(object as THREE.SkinnedMesh);
    });
    if (found.length === 0) throw new Error("A body piece came out of umodel with no skinned mesh");
    return found;
  };

  const primary = meshesOf(pieces[0].group)[0];
  const bones = [...primary.skeleton.bones];
  const boneInverses = [...primary.skeleton.boneInverses];
  // Matched loosely on purpose. The client spells one joint several ways:
  // "Bip01_Pelvis" on a body piece, "Bip01 Pelvis" on a hair one, and
  // "bip01_spine" beside "Bip01_Spine1" within a single skeleton. Compared
  // literally, a piece that merely capitalises differently looks like a rig
  // of its own and gets adopted whole -- a second skeleton's worth of joints
  // no animation drives, with the geometry weighted to them left standing
  // still. The bone keeps whatever name it arrived with; only the lookup is
  // normalised.
  const boneKey = (name: string) => THREE.PropertyBinding.sanitizeNodeName(name).toLowerCase();
  const boneIndexByName = new Map(bones.map((bone, index) => [boneKey(bone.name), index]));
  const adopted: string[] = [];
  /** Indices of the joints above, which unlike matched ones sit wherever their new parent put them. */
  const adoptedIndices = new Set<number>();
  // Whatever holds the body's own root joint, which is the frame every
  // skeleton in the file is expressed in.
  const bodySpace = (bones.find((bone) => !(bone.parent as THREE.Bone | null)?.isBone) ?? bones[0]).parent as THREE.Object3D;
  const reattached: string[] = [];
  const aligned: string[] = [];

  /** A joint the primary skeleton doesn't have -- hair strands, and the weapon attachment points a hairstyle piece drags along. */
  function adoptBone(pieceBone: THREE.Bone): number {
    const name = THREE.PropertyBinding.sanitizeNodeName(pieceBone.name);
    const existing = boneIndexByName.get(boneKey(pieceBone.name));
    if (existing !== undefined) return existing;

    const pieceParent = pieceBone.parent as THREE.Bone | null;
    // A piece rigged on a skeleton of its own has a root joint whose parent
    // is the mesh rather than another joint, and where it belongs depends on
    // whether anything drives it.
    //
    // The Kamael wing has an animation set of its own, written in the body's
    // space -- it puts the wing's root 36 units up, which is a height above
    // the character's feet and not an offset from anything -- so the wing
    // goes beside the body's root joint and its own animation moves it from
    // there, the way the client attaches it. Hanging it off a joint instead
    // adds that joint's transform to every frame: invisible in the reference
    // pose, where the bind matrices cancel it, and a wing thrown wide open
    // the moment anything plays.
    //
    // Hair strands are the other kind, and want the opposite. Nothing
    // animates them, so they have to ride the joint they rest against or they
    // stay behind while the head turns.
    const parent = pieceParent?.isBone
      ? bones[adoptBone(pieceParent)]
      : selfAnimated.has(boneKey(pieceBone.name))
        ? bodySpace
        : nearestBone(bones, new THREE.Vector3().setFromMatrixPosition(pieceBone.matrixWorld));
    const clone = pieceBone.clone(false);
    clone.name = name;
    parent.add(clone);
    clone.updateMatrixWorld(true);

    bones.push(clone);
    boneInverses.push(new THREE.Matrix4().copy(clone.matrixWorld).invert());
    boneIndexByName.set(boneKey(name), bones.length - 1);
    adopted.push(name);
    adoptedIndices.add(bones.length - 1);
    return bones.length - 1;
  }

  const geometries: THREE.BufferGeometry[] = [];
  const slots: string[] = [];
  for (const piece of pieces) {
    piece.group.updateMatrixWorld(true);
    for (const mesh of meshesOf(piece.group)) {

    const geometry = mesh.geometry.clone();
    // Re-point skinIndex at the shared bone array: a piece may reference a
    // subset of the skeleton, in its own order, and a silently mismatched
    // index is a limb hanging off the wrong joint.
    const remap = mesh.skeleton.bones.map((bone) => adoptBone(bone));
    // An unskinned piece carries every vertex on the root, so pointing that
    // one entry at the joint it hangs from moves the whole piece onto it.
    const rigid = rigidAttachment(mesh);
    if (rigid) {
      remap[rigid.root] = adoptBone(rigid.bone);
      reattached.push(`${piece.name} -> ${THREE.PropertyBinding.sanitizeNodeName(rigid.bone.name)}`);
    }
    // Only a rigidly attached piece can need moving, and only when it came
    // off another rig: it carries no weights to say where it belongs, so it
    // sits wherever its own skeleton left it. The female orc mystic wears a
    // female orc body with a shaman's face, and the shaman's head joint rests
    // 0.1 units lower -- exactly how far her face sank into her shoulders.
    // Moving it by the difference at the joint it hangs from is the whole
    // correction, and a no-op when the two agree.
    //
    // A skinned piece needs nothing, even one whose skeleton rests in a pose
    // of its own: its vertices are already in the space every other piece is
    // in, and its weights put them back there against any skeleton whose
    // joints rest where this one's do. Measured, not assumed -- the male dark
    // elf's torso is the one piece of him published in a different pose, and
    // it lines up with the rest of him untouched. What did break him was that
    // pose leading the merge, which the ordering above now prevents.
    if (rigid) {
      const held = mesh.skeleton.bones.indexOf(rigid.bone);
      const anchor = held < 0 ? -1 : adoptBone(rigid.bone);
      // Not against an adopted joint: that is a copy of the piece's own,
      // re-parented onto whatever it rests against, so measuring the piece
      // against it measures it against itself.
      if (anchor >= 0 && !adoptedIndices.has(anchor)) {
        const shift = new THREE.Vector3()
          .setFromMatrixPosition(bones[anchor].matrixWorld)
          .sub(new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.bones[held].matrixWorld));
        if (shift.length() > 0.001) {
          geometry.translate(shift.x, shift.y, shift.z);
          aligned.push(`${piece.name} by ${(shift.length() * UNIT_SCALE).toFixed(1)}`);
        }
      }
    }

    const skinIndex = (geometry.getAttribute("skinIndex") as THREE.BufferAttribute).array;
    for (let i = 0; i < skinIndex.length; i++) skinIndex[i] = remap[skinIndex[i]];

    // mergeGeometries insists on identical attribute sets; drop what this
    // pipeline doesn't use rather than requiring every piece to carry it.
    for (const name of Object.keys(geometry.attributes)) {
      if (!["position", "normal", "uv", "skinIndex", "skinWeight"].includes(name)) {
        geometry.deleteAttribute(name);
      }
    }
      geometries.push(geometry);
      slots.push(piece.slot);
    }
  }

  // Per part first, then the parts together with groups -- glTF turns every
  // group into its own primitive, so a body comes out as one draw call per
  // part. That is the floor: a part carries its own texture, so it cannot
  // share a material with another. The names are what the runtime finds them
  // by (see instantiateCharacterModel).
  // BODY_PARTS is still the order, with each part's slots kept in the order
  // they were merged -- which for hair is the order the styles are offered in.
  const slotOrder = BODY_PARTS.flatMap((part) => [
    ...new Set(slots.filter((slot) => slot === part || slot.startsWith(`${part}-`))),
  ]);
  const partGeometries = slotOrder
    .map((slot) => {
      const forSlot = geometries.filter((_, index) => slots[index] === slot);
      return forSlot.length > 0 ? mergeGeometries(forSlot, false) : null;
    })
    .filter((geometry): geometry is THREE.BufferGeometry => geometry !== null);

  const merged = mergeGeometries(partGeometries, true);
  if (!merged) throw new Error("Body pieces have incompatible geometry attributes");

  primary.geometry = merged;
  // Rebind: adopting joints changed the array the skin indices point into.
  primary.bind(new THREE.Skeleton(bones, boneInverses), primary.bindMatrix);
  primary.material = slotOrder.map(
    (slot) =>
      new THREE.MeshStandardMaterial({
        name: slot,
        color: 0xffffff,
        roughness: 0.75,
        // A wing is a single sheet of triangles, not a closed volume, and the
        // side of it that faces a viewer standing in front of the character
        // is its back -- drawn one-sided it disappears except for a sliver at
        // the shoulder. Everything else on a body is closed and keeps the
        // cheaper single-sided draw.
        side: slot === "wing" ? THREE.DoubleSide : THREE.FrontSide,
      })
  );
  primary.name = "body";

  // Only the first piece's tree is exported, so the other pieces' skeletons --
  // copies of this one -- never reach the file. Any skinned mesh left in that
  // tree besides the merged body goes too, or it would ride along whole.
  const root = pieces[0].group;
  for (const piece of pieces.slice(1)) piece.group.clear();
  for (const mesh of meshesOf(root)) if (mesh !== primary) mesh.removeFromParent();

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const boneNames = new Set(bones.map((bone) => THREE.PropertyBinding.sanitizeNodeName(bone.name)));
  return { root, boneNames, height: (box.max.y - box.min.y) * UNIT_SCALE, adopted, reattached, aligned };
}

/**
 * Where a part's texture lives in the rig's own SysTextures package, and how
 * many of it there are.
 *
 * The client names them <rig>_m000_t<variant>_<part>, and the variant counts
 * are not arbitrary: three faces and four hair colours is exactly what
 * character creation offers, because in retail both of those choices are a
 * texture swap on one mesh rather than a different mesh. Parts that do not
 * vary carry the t1000 id, which is the starting body's own. Some are
 * published as _ori beside an _sp specular map this pipeline has no use for,
 * so each part lists what to try.
 */
/**
 * A texture's name, built from the mesh's own: the client puts the texture id
 * where the set id sits in the mesh name, so MOrc_m000_m00_bh is dressed by
 * MOrc_m000_t00_m00_bh. Deriving it rather than spelling out a pattern per
 * part is what keeps a piece and its texture in step -- the female orc mystic
 * wears the _ah hairstyle, and the _bh texture would land on it with the
 * wrong UVs.
 */
function textureName(rig: string, suffix: string, id: string): string {
  const cut = suffix.indexOf("_");
  return `${rig}_${suffix.slice(0, cut)}_t${id}_${suffix.slice(cut + 1)}`;
}

/**
 * Bare skin. The id beside it, t01, is the squire's shirt on the same mesh --
 * the client picks between them by what the character is wearing, and nothing
 * here models equipment yet.
 *
 * Only the fallback path below still reasons in terms of this id. When the
 * client's armour table can be read it says outright which mesh and texture
 * each rig wears with a slot empty, and this stops being a guess -- see
 * loadBareBodies.
 */
const BARE = "02";

/**
 * What each rig wears with nothing equipped, straight out of the client's
 * armour table -- mesh and texture, per rig, for the torso, legs, boots and
 * gloves.
 *
 * Loaded once per run and left undefined when the table cannot be read, which
 * is the only reason bodySet and the name-guessing in bare() are still here.
 * Their answers were close but not right: they missed the mystics' legs and
 * boots entirely (falling back to m000's t1000, which is unused art) and had
 * no way at all to find the Kamael's gloves, which are m002_t10 rather than
 * any t02.
 */
let bareBodyTable: Record<ArmorSlot, Partial<Record<string, ArmorBody>>> | undefined;

const ARMOR_PART_SLOTS: Partial<Record<BodyPart, ArmorSlot>> = {
  upper: "upper",
  lower: "lower",
  boots: "boots",
  gloves: "gloves",
};

function loadBareBodies(client: string): void {
  const file = path.join(client, "system", "armorgrp.dat");
  try {
    bareBodyTable = bareBodies(readArmorgrp(file));
  } catch (error) {
    console.warn(
      `Could not read ${file} (${error instanceof Error ? error.message : String(error)}).\n` +
        "  Falling back to guessing bare bodies from texture names, which is wrong for the mystics and the Kamael."
    );
  }
}

/** The armour table's entry for a rig's bare body part, where there is one. */
function bareBody(rig: string, part: BodyPart): ArmorBody | undefined {
  const slot = ARMOR_PART_SLOTS[part];
  return slot && bareBodyTable ? bareBodyTable[slot][rig] : undefined;
}

/**
 * Every texture name a rig's package holds, read once and kept.
 *
 * Worth the extra call to umodel: which set a body part comes from is not the
 * same for every rig, and the only honest way to tell is to look at what is
 * actually published.
 */
const textureNames = new Map<string, Set<string>>();

function listTextures(umodel: string, client: string, rig: string): Set<string> {
  let names = textureNames.get(rig);
  if (names) return names;
  names = new Set<string>();
  const result = spawnSync(umodel, [`-path=${client}`, "-game=l2", "-list", `SysTextures\\${rig}.utx`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  for (const line of (result.stdout ?? "").split("\n")) {
    const match = /Texture\s+(\S+)/.exec(line);
    if (match) names.add(match[1].toLowerCase());
  }
  textureNames.set(rig, names);
  return names;
}

/**
 * Which set a rig's bare body comes from, part by part.
 *
 * The id is what identifies it -- t02 is bare skin and t01 the squire's shirt
 * on the same mesh -- but the set that holds it is not fixed. It is m001 for
 * most, and then the human mystics keep their bare legs and boots in m003 and
 * their gloves in m005, the female mystic her torso in m003 and her boots in
 * m002. Nothing in the naming says so, so the set is found by looking for the
 * id across all of them.
 *
 * Some parts have no t02 anywhere -- most rigs' legs, the male mystic's torso
 * -- and fall back to m000's t1000, which is the older art the client still
 * ships. Those are the ones to check first when a body looks wrong.
 */
function bodySet(umodel: string, client: string, rig: string, part: string): string {
  const names = listTextures(umodel, client, rig);
  const bare = new RegExp(`^${rig}_(m\\d{3})_t${BARE}_${part}(_ori|_sp)?$`, "i");
  const sets: string[] = [];
  for (const name of names) {
    const match = bare.exec(name);
    if (match) sets.push(match[1].toLowerCase());
  }
  // Lowest wins where more than one carries it: the sets run oldest first, and
  // no rig in the client publishes the same part twice under this id anyway.
  if (sets.length > 0) return sets.sort()[0];

  if (
    names.has(`${rig}_m000_t1000_${part}`.toLowerCase()) ||
    names.has(`${rig}_m000_t1000_${part}_ori`.toLowerCase())
  ) {
    return "m000";
  }
  // Nothing of its own. m001 is where the Kamael keep the shared sheet the
  // fallback below picks up, and the run reports anything left bare.
  return "m001";
}

/**
 * Which mesh a rig's bare body part is, as the suffix after the rig's name.
 *
 * The armour table names it outright ("Magic.MMagic_m005_u" for the male
 * mystic's torso); bodySet's search of the texture names is what answers when
 * the table could not be read.
 */
function bodySuffix(umodel: string, client: string, rig: string, piece: PieceSource): string {
  const letter = piece.bodyPart!;
  const mesh = bareBody(rig, piece.part)?.mesh[0];
  if (mesh) {
    const { object } = splitObjectName(mesh);
    // "MMagic_m005_u" -> "m005_u"; the rig prefix is added back by the caller.
    if (object.toLowerCase().startsWith(`${rig.toLowerCase()}_`)) return object.slice(rig.length + 1);
  }
  return `${bodySet(umodel, client, rig, letter)}_${letter}`;
}

/**
 * Whether a rig ships a texture for a piece the player is offered a choice of.
 *
 * The mesh alone is not enough to offer one. The orcs, the shamans and the
 * male dwarf all publish an `ah` head their package has no texture for, and
 * the client never shows it -- chargrp.dat lists only `bh` for them. Merging
 * it anyway put an untextured head inside the body and, because the merge
 * measures what it merged, made the male orc six units taller than he is.
 */
function hasChoiceTexture(umodel: string, client: string, rig: string, suffix: string): boolean {
  const names = listTextures(umodel, client, rig);
  const base = textureName(rig, suffix, "00").toLowerCase();
  return names.has(base) || names.has(`${base}_ori`);
}

/**
 * Bare skin for a body part, published plainly or as _ori beside an _sp map
 * this pipeline has no use for.
 *
 * Falling back to the set's "ut" sheet last: the Kamael are dressed rather
 * than bare, and their legs and gloves have no diffuse of their own -- both
 * are painted on one sheet with the torso, which is what ut holds.
 */
function bare(rig: string, suffix: string, part: BodyPart): string[] {
  const named = bareBody(rig, part)?.texture.map((name) => splitObjectName(name).object) ?? [];
  // Named outright, and still with the two spellings after it: the plain
  // name is sometimes a Shader rather than an image, and what it points at
  // is the _ori or _sp beside it.
  if (named.length > 0) {
    return named.flatMap((name) => [name, `${name}_ori`, `${name}_sp`]);
  }

  // The id belongs to the set the suffix names: t02 in m001, t1000 in m000.
  const set = suffix.slice(0, suffix.indexOf("_"));
  const id = set === "m000" ? "1000" : BARE;
  const own = textureName(rig, suffix, id);
  const shared = textureName(rig, `${set}_ut`, id);
  // `_sp` last, and it is not always the specular map its name suggests:
  // where the plain name belongs to a Shader rather than a Texture -- the
  // human mystic's torso is one -- that shader's diffuse is the _sp image,
  // and it is the only pixels there are. Its alpha carries a gloss mask
  // rather than transparency, which is why the runtime ignores alpha on
  // everything but the parts that are genuinely cut out.
  return [own, `${own}_ori`, shared, `${shared}_ori`, `${own}_sp`, `${shared}_sp`];
}

const PART_TEXTURES: Record<
  BodyPart,
  { variants: number; candidates: (rig: string, variant: number, suffix: string) => string[] }
> = {
  face: { variants: 3, candidates: (rig, v, suffix) => [textureName(rig, suffix, `0${v}`)] },
  hair: {
    variants: 4,
    candidates: (rig, v, suffix) => [textureName(rig, suffix, `0${v}`), `${textureName(rig, suffix, `0${v}`)}_ori`],
  },
  upper: { variants: 1, candidates: (rig, _v, suffix) => bare(rig, suffix, "upper") },
  lower: { variants: 1, candidates: (rig, _v, suffix) => bare(rig, suffix, "lower") },
  boots: { variants: 1, candidates: (rig, _v, suffix) => bare(rig, suffix, "boots") },
  gloves: { variants: 1, candidates: (rig, _v, suffix) => bare(rig, suffix, "gloves") },
  // The wing is the exception: its mesh is an "ad00" attachment while its
  // texture is filed plainly under w.
  wing: { variants: 1, candidates: (rig) => [`${rig}_m000_t00_w_ori`, `${rig}_m000_t00_w`] },
};

/**
 * What the runtime needs to know about a rig's textures: how many variants of
 * each part it ships, and which parts must not be alpha-tested.
 *
 * Alpha carries two different things in this art. Where a body part's texture
 * came from an `_sp` image, the alpha is the specularity mask the client's own
 * material declares it to be -- the RGB there is the whole picture, right
 * through the fully transparent pixels, and testing against it erases the
 * body. Everywhere else -- hair, faces, the Kamael wing and the cloth on their
 * chest -- alpha is an ordinary cut-out, and *not* testing it paints those
 * regions black, because that is what the art has under them.
 *
 * The `_sp` name is what tells the two apart, and it is not a guess: those are
 * the images a shader names as its diffuse while naming the same image as its
 * SpecularityMask. Checked against the pixels of all sixteen rigs -- every
 * `_sp` texture has colour under its transparent pixels and every other one is
 * black there.
 */
export interface TextureEntry {
  /** Slot -> how many variants of it the rig ships. Hair slots carry a style index, see slotName. */
  [slot: string]: number | string[] | undefined;
  /** Slots whose alpha is a specularity mask rather than transparency. */
  gloss?: string[];
}

export type TextureManifest = Record<string, TextureEntry>;

/**
 * Pulls every texture a body needs out of the client, as PNG.
 *
 * A part is taken from the package of the rig the *piece* came from, not the
 * rig being built: the female orc mystic wears a female orc body, and it has
 * to be textured like one.
 */
async function exportTextures(
  umodel: string,
  client: string,
  workDir: string,
  rig: string,
  pieces: { part: BodyPart; slot: string; rig: string; suffix: string }[]
): Promise<TextureEntry> {
  const outDir = path.join(OUT_TEXTURE_DIR, rig.toLowerCase());
  await fs.promises.mkdir(outDir, { recursive: true });
  const counts: Record<string, number> = {};
  const gloss: string[] = [];
  const written = new Set<string>();

  for (const piece of new Map(pieces.map((piece) => [piece.slot, piece])).values()) {
    const { variants, candidates } = PART_TEXTURES[piece.part];
    let count = 0;
    for (let variant = 0; variant < variants; variant++) {
      let source: string | undefined;
      let chosen: string | undefined;
      for (const name of candidates(piece.rig, variant, piece.suffix)) {
        const file = path.join(workDir, "textures", piece.rig, "Texture", `${name}.png`);
        if (!fs.existsSync(file)) {
          try {
            runUmodel(umodel, client, [
              "-export",
              "-png",
              `-out=${path.join(workDir, "textures")}`,
              `SysTextures\\${piece.rig}.utx`,
              name,
            ]);
          } catch {
            continue; // a name this rig does not use
          }
        }
        if (fs.existsSync(file)) {
          source = file;
          chosen = name;
          break;
        }
      }
      // Variants run out rather than skip: a rig with two faces has t00 and
      // t01, never t00 and t02, so the first gap is the end of the list.
      if (!source) break;
      const name = `${piece.slot}-${variant}.png`;
      await fs.promises.copyFile(source, path.join(outDir, name));
      written.add(name);
      if (chosen?.toLowerCase().endsWith("_sp") && !gloss.includes(piece.slot)) gloss.push(piece.slot);
      count++;
    }
    if (count > 0) counts[piece.slot] = count;
  }

  // Anything left from an earlier conversion goes: slots have been renamed
  // before now (hair grew a style index), and a file the manifest no longer
  // mentions is at best dead weight and at worst the one a stale client asks
  // for.
  for (const name of await fs.promises.readdir(outDir)) {
    if (name.endsWith(".png") && !written.has(name)) await fs.promises.rm(path.join(outDir, name));
  }

  // Always written, empty included: its presence is how the runtime knows
  // this manifest can answer the question at all. An older one that cannot
  // must leave alpha alone rather than guess.
  return { ...counts, gloss };
}

async function convertRig(
  umodel: string,
  client: string,
  workDir: string,
  source: ClientRig
): Promise<TextureEntry> {
  const pieceSources: PieceSource[] = [...(source.pieces ?? BODY_PIECES), ...(source.extraPieces ?? [])];
  const exported: {
    file: string;
    part: BodyPart;
    slot: string;
    own: boolean;
    rig: string;
    pkg: string;
    suffix: string;
    primary?: boolean;
  }[] = [];

  // Styles are numbered as they are found, not as they are declared: the orcs
  // ship no `ah` head, and a gap in the numbering would leave the runtime
  // offering a choice that selects nothing.
  const choices = new Map<BodyPart, number>();
  for (const piece of pieceSources) {
    const from = piece.from ?? { pkg: source.pkg, rig: source.rig };
    const suffix = piece.suffix ?? bodySuffix(umodel, client, from.rig, piece);
    const object = `${from.rig}_${suffix}`;
    const outDir = path.join(workDir, from.pkg);
    const file = path.join(outDir, from.pkg, "SkeletalMesh", `${object}.gltf`);
    if (!fs.existsSync(file)) {
      try {
        runUmodel(umodel, client, ["-export", "-gltf", `-out=${outDir}`, `Animations\\${from.pkg}.ukx`, object]);
      } catch {
        continue; // a rig that doesn't ship this piece simply has fewer of them
      }
    }
    if (!fs.existsSync(file)) continue;
    if (piece.choice && !hasChoiceTexture(umodel, client, from.rig, suffix)) continue;
    const style = piece.choice ? (choices.get(piece.part) ?? 0) : 0;
    if (piece.choice) choices.set(piece.part, style + 1);
    exported.push({
      file,
      part: piece.part,
      slot: slotName(piece.part, style),
      own: from.pkg === source.pkg,
      rig: from.rig,
      pkg: from.pkg,
      suffix,
      primary: piece.primary,
    });
  }
  if (exported.length === 0) throw new Error(`No body pieces found for ${source.rig}`);

  const psaDir = path.join(workDir, `${source.pkg}-anim`);
  const extraAnims = (source.extraAnimObjects ?? []).map((object) => {
    const file = path.join(psaDir, source.pkg, "MeshAnimation", `${object}.psa`);
    if (!fs.existsSync(file)) {
      runUmodel(umodel, client, ["-export", `-out=${psaDir}`, `Animations\\${source.pkg}.ukx`, object]);
    }
    const loaded = readPsa(file);
    return { psa: loaded, bySequence: new Map(loaded.sequences.map((s) => [s.name.toLowerCase(), s])) };
  });
  /** Joints some other animation drives -- what tells a piece that moves on its own from one merely carried along. */
  const selfAnimated = new Set(
    extraAnims.flatMap((extra) =>
      extra.psa.boneNames.map((name) => THREE.PropertyBinding.sanitizeNodeName(name).toLowerCase())
    )
  );

  const loaded = await Promise.all(
    exported.map(async (piece) => ({
      ...piece,
      group: await loadPiece(piece.file),
      name: path.basename(piece.file, ".gltf"),
    }))
  );

  // Whichever rest pose most of the body agrees on leads the merge. Taking
  // the first piece instead put the male dark elf together around his torso,
  // which is the one piece of him published in a different pose -- his head,
  // hands, legs and boots all came out displaced around it. The majority is
  // the safe read: a piece that disagrees with everything else is the odd one
  // out by definition, and it is reported below rather than silently
  // out-voted.
  const fingerprints = new Map(loaded.map((piece) => [piece, skeletonFingerprint(piece.group)]));
  const votes = new Map<string, number>();
  for (const fingerprint of fingerprints.values()) votes.set(fingerprint, (votes.get(fingerprint) ?? 0) + 1);
  const agreed = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  const odd = loaded.filter((piece) => fingerprints.get(piece) !== agreed).map((piece) => piece.name);

  // An explicit lead still wins: a body borrowed from another rig has to be
  // the skeleton, however few pieces come with it, because it is the largest
  // and most finely skinned part and every joint of it has to keep the rest
  // position it was weighted against (see FShaman, and the alignment in
  // assemble that moves the head pieces onto it).
  const pieces = loaded.sort(
    (a, b) =>
      Number(b.primary ?? false) - Number(a.primary ?? false) ||
      Number(fingerprints.get(b) === agreed) - Number(fingerprints.get(a) === agreed) ||
      Number(b.own) - Number(a.own)
  );
  const body = assemble(pieces, selfAnimated);

  const psaFile = path.join(psaDir, source.pkg, "MeshAnimation", `${source.animObject}.psa`);
  if (!fs.existsSync(psaFile)) {
    runUmodel(umodel, client, ["-export", `-out=${psaDir}`, `Animations\\${source.pkg}.ukx`, source.animObject]);
  }
  const psa: PsaFile = readPsa(psaFile);
  const bySequence = new Map(psa.sequences.map((sequence) => [sequence.name.toLowerCase(), sequence]));


  const clips: THREE.AnimationClip[] = [];
  const missing: string[] = [];
  for (const wanted of CLIPS) {
    let sequence: PsaSequence | undefined;
    let taken: string | undefined;
    for (const candidate of wanted.candidates) {
      sequence = bySequence.get(`${candidate}_${source.rig}`.toLowerCase());
      if (sequence && sequence.rate > 0) {
        taken = candidate;
        break;
      }
      sequence = undefined;
    }
    if (!sequence || !taken) {
      missing.push(wanted.name);
      continue;
    }

    const options = { boneNames: body.boneNames, rootBone: ROOT_BONE, inPlace: wanted.inPlace };
    const clip = toThreeClip(psa, sequence, wanted.name, options);
    // The same sequence off the other skeletons, appended to the same clip:
    // three plays one clip per state over the whole body, so a piece with an
    // animation of its own has to ride inside it.
    for (const extra of extraAnims) {
      const alongside = extra.bySequence.get(`${taken}_${source.rig}`.toLowerCase());
      if (!alongside || alongside.rate <= 0) continue;
      clip.tracks.push(...toThreeClip(extra.psa, alongside, wanted.name, options).tracks);
    }
    clips.push(clip);
  }

  // On the node rather than baked into the vertices, so it reaches the bones
  // too -- which is why the clips above stay in the rig's own pre-scale units.
  body.root.scale.setScalar(UNIT_SCALE);

  const glb = (await new GLTFExporter().parseAsync(body.root, {
    binary: true,
    animations: clips,
    embedImages: false,
  })) as ArrayBuffer;

  const outFile = path.join(OUT_DIR, `${source.rig.toLowerCase()}.glb`);
  await fs.promises.writeFile(outFile, Buffer.from(glb));

  const textures = await exportTextures(umodel, client, workDir, source.rig, exported);
  const untextured = [...new Set(exported.map((piece) => piece.slot))].filter((slot) => !textures[slot]);
  console.log(
    `  ${source.rig}: ${exported.length} pieces, ${clips.length} clips, ` +
      `${Math.round(body.height)} units tall, ${Math.round(glb.byteLength / 1024)} KB -> ${path.basename(outFile)}` +
      (body.adopted.length ? `  (+${body.adopted.length} joints from other pieces)` : "") +
      (body.reattached.length ? `  (attached: ${body.reattached.join(", ")})` : "") +
      (body.aligned.length ? `  (aligned: ${body.aligned.join(", ")})` : "") +
      (odd.length ? `  (rest pose of its own: ${odd.join(", ")})` : "") +
      (missing.length ? `  (no sequence for ${missing.join("/")})` : "") +
      `  (textures: ${Object.entries(textures)
        .filter(([slot, count]) => slot !== "gloss" && typeof count === "number")
        .map(([slot, count]) => `${slot}x${String(count)}`)
        .join(" ")})` +
      (untextured.length ? `  (no texture for ${untextured.join("/")})` : "")
  );

  return textures;
}

async function main(): Promise<void> {
  const client = readArg("--client") ?? process.env.L2_CLIENT_DIR;
  const umodel = readArg("--umodel") ?? process.env.UMODEL;
  if (!client || !umodel) {
    console.error(
      'Both are required, e.g. --client="D:\\Games\\Lineage2\\L2_HighFive_Client" --umodel="C:\\ue_viewer\\umodel_64.exe"\n' +
        "(or set L2_CLIENT_DIR / UMODEL)."
    );
    process.exitCode = 1;
    return;
  }

  loadBareBodies(client);

  const only = readArg("--only");
  const rigs = only ? RIGS.filter((rig) => rig.rig.toLowerCase() === only.toLowerCase()) : RIGS;
  if (rigs.length === 0) {
    console.error(`No rig named ${only}. Known: ${RIGS.map((rig) => rig.rig).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const workDir = readArg("--work") ?? (await fs.promises.mkdtemp(path.join(os.tmpdir(), "l2-rigs-")));
  console.log(`Converting ${rigs.length} rig(s) into ${OUT_DIR}`);

  // Merged into whatever is already there, so converting one rig with --only
  // does not drop the others out of the index.
  const indexFile = path.join(OUT_TEXTURE_DIR, "index.json");
  let manifest: TextureManifest = {};
  try {
    manifest = JSON.parse(await fs.promises.readFile(indexFile, "utf8")) as TextureManifest;
  } catch {
    manifest = {};
  }

  for (const rig of rigs) {
    manifest[rig.rig.toLowerCase()] = await convertRig(umodel, client, workDir, rig);
  }

  await fs.promises.mkdir(OUT_TEXTURE_DIR, { recursive: true });
  await fs.promises.writeFile(indexFile, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Texture index: ${indexFile}`);

  if (!readArg("--work")) await fs.promises.rm(workDir, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
