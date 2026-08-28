/**
 * Builds the character bodies the Unity project has no models for -- orcs and
 * Kamael -- straight out of an installed Lineage 2 client, into the same
 * `<rig>.glb` shape convert-unity-models.ts produces for the other ten.
 *
 * Why a second pipeline rather than an extension of the first: the sources
 * have nothing in common. That one reads a Unity project (FBX pieces plus
 * `.anim` YAML); this one reads the client's own packages through UE Viewer
 * (https://www.gildor.org) -- body pieces as glTF, animations as PSA. What
 * they share is the output: same clip names, same skeleton conventions, same
 * units, so the web client can't tell which produced a given body.
 *
 * One thing this path gets for free that the other had to reconstruct: clip
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
import { MATERIAL_SLOTS, type MaterialSlot } from "./models/fbx-body";
import { readPsa, toThreeClip, type PsaFile, type PsaSequence } from "./models/psa-anim";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/highfive/models");

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

interface PieceSource {
  /** Suffix after the rig name, e.g. "m000_u". */
  suffix: string;
  /** Which tint the runtime paints it with -- the merged mesh gets one material per slot. */
  slot: MaterialSlot;
  /**
   * Alternatives, not additions: pieces sharing a variant name fill the same
   * spot on the body different ways, and only the first one a rig actually
   * ships is taken. The client picks between them by the character's own
   * appearance -- hairStyle for these -- which nothing in this pipeline
   * models yet, and merging every candidate puts two haircuts on one head.
   */
  variant?: string;
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
  /** Replaces BODY_PIECES outright, for a body assembled from more than one package -- see FShaman. */
  pieces?: PieceSource[];
  /** Added on top of whichever list applies, for a part only this rig has. */
  extraPieces?: PieceSource[];
}

/** The pieces a body is made of, in the same slots the Unity path uses. */
const BODY_PIECES: PieceSource[] = [
  { suffix: "m000_u", slot: "outfit" },
  { suffix: "m000_l", slot: "outfit" },
  { suffix: "m000_b", slot: "outfit" },
  { suffix: "m000_g", slot: "skin" },
  { suffix: "m000_f", slot: "skin" },
  { suffix: "m000_m00_bh", slot: "hair", variant: "hair" },
  { suffix: "m000_m00_ah", slot: "hair", variant: "hair" },
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
const WING: PieceSource[] = [{ suffix: "m000_w_ad00", slot: "wing" }];

const RIGS: ClientRig[] = [
  { rig: "MOrc", pkg: "Orc", animObject: "MOrc_anim" },
  { rig: "FOrc", pkg: "Orc", animObject: "FOrc_anim" },
  { rig: "MShaman", pkg: "Shaman", animObject: "MShaman_anim" },
  // The female orc mystic is the female orc from the neck down -- the Shaman
  // package ships her face and hair and nothing else, so the body comes from
  // FOrc. Measured rather than assumed: her face and hair meshes differ from
  // FOrc's (234 vs 236 and 212 vs 100 vertices, different geometry), so they
  // are hers and the rest is not.
  {
    rig: "FShaman",
    pkg: "Shaman",
    animObject: "FShaman_anim",
    pieces: [
      { suffix: "m000_u", slot: "outfit", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_l", slot: "outfit", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_b", slot: "outfit", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_g", slot: "skin", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_f", slot: "skin" },
      { suffix: "m000_m00_ah", slot: "hair" },
    ],
  },
  // Wings are a Kamael part and nothing else has one. They come as a mesh
  // with an eighteen-joint skeleton of its own (Main_wing and Bone13..Bone46,
  // sharing no name with the body), which is why assemble() has to work out
  // where a foreign skeleton attaches -- see adoptBone.
  { rig: "MKamael", pkg: "Kamael", animObject: "MKamael_anim", extraPieces: WING },
  { rig: "FKamael", pkg: "Kamael", animObject: "FKamael_anim", extraPieces: WING },
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
function assemble(pieces: { group: THREE.Group; slot: MaterialSlot; name: string }[]): AssembledBody {
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
  const reattached: string[] = [];

  /** A joint the primary skeleton doesn't have -- hair strands, and the weapon attachment points a hairstyle piece drags along. */
  function adoptBone(pieceBone: THREE.Bone): number {
    const name = THREE.PropertyBinding.sanitizeNodeName(pieceBone.name);
    const existing = boneIndexByName.get(boneKey(pieceBone.name));
    if (existing !== undefined) return existing;

    const pieceParent = pieceBone.parent as THREE.Bone | null;
    // A piece rigged on a skeleton of its own -- the Kamael wings -- has a
    // root joint whose parent is the mesh rather than another joint. Hanging
    // that off the body's own root would strap the wings to the pelvis; the
    // joint they belong to is the one they rest against, which for the wings
    // is the top of the spine they are modelled onto.
    const parent = pieceParent?.isBone
      ? bones[adoptBone(pieceParent)]
      : nearestBone(bones, new THREE.Vector3().setFromMatrixPosition(pieceBone.matrixWorld));
    const clone = pieceBone.clone(false);
    clone.name = name;
    parent.add(clone);
    clone.updateMatrixWorld(true);

    bones.push(clone);
    boneInverses.push(new THREE.Matrix4().copy(clone.matrixWorld).invert());
    boneIndexByName.set(boneKey(name), bones.length - 1);
    adopted.push(name);
    return bones.length - 1;
  }

  const geometries: THREE.BufferGeometry[] = [];
  const slots: MaterialSlot[] = [];
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

  // Per tint slot first, then the slots together with groups -- glTF turns
  // every group into its own primitive, so this is the difference between one
  // draw call per body and one per body part. It is also what gives the
  // runtime the three materials it paints a character by (see
  // instantiateCharacterModel, which looks them up by name).
  const slotGeometries = MATERIAL_SLOTS.map((slot) => {
    const forSlot = geometries.filter((_, index) => slots[index] === slot);
    return forSlot.length > 0 ? mergeGeometries(forSlot, false) : null;
  }).filter((geometry): geometry is THREE.BufferGeometry => geometry !== null);

  const merged = mergeGeometries(slotGeometries, true);
  if (!merged) throw new Error("Body pieces have incompatible geometry attributes");

  primary.geometry = merged;
  // Rebind: adopting joints changed the array the skin indices point into.
  primary.bind(new THREE.Skeleton(bones, boneInverses), primary.bindMatrix);
  primary.material = MATERIAL_SLOTS.filter((slot) => slots.includes(slot)).map(
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
  return { root, boneNames, height: (box.max.y - box.min.y) * UNIT_SCALE, adopted, reattached };
}

async function convertRig(umodel: string, client: string, workDir: string, source: ClientRig): Promise<void> {
  const pieceSources: PieceSource[] = [...(source.pieces ?? BODY_PIECES), ...(source.extraPieces ?? [])];
  const exported: { file: string; slot: MaterialSlot; own: boolean }[] = [];

  const filled = new Set<string>();
  for (const piece of pieceSources) {
    if (piece.variant && filled.has(piece.variant)) continue;
    const from = piece.from ?? { pkg: source.pkg, rig: source.rig };
    const object = `${from.rig}_${piece.suffix}`;
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
    exported.push({ file, slot: piece.slot, own: from.pkg === source.pkg });
    if (piece.variant) filled.add(piece.variant);
  }
  if (exported.length === 0) throw new Error(`No body pieces found for ${source.rig}`);

  // The rig's own pieces first, so the skeleton everything else is merged
  // onto is the one its animations were authored against. It matters for a
  // body assembled from two packages: the shaman rigs carry 109 bones where
  // the orc body they borrow has 78, and leading with the borrowed one would
  // make the animated skeleton the smaller, wrong one -- every joint the
  // clips know but the body doesn't would arrive as a duplicate nothing
  // drives.
  const ordered = [...exported].sort((a, b) => Number(b.own) - Number(a.own));
  const pieces = await Promise.all(
    ordered.map(async (piece) => ({
      group: await loadPiece(piece.file),
      slot: piece.slot,
      name: path.basename(piece.file, ".gltf"),
    }))
  );
  const body = assemble(pieces);

  const psaDir = path.join(workDir, `${source.pkg}-anim`);
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
    for (const candidate of wanted.candidates) {
      sequence = bySequence.get(`${candidate}_${source.rig}`.toLowerCase());
      if (sequence && sequence.rate > 0) break;
      sequence = undefined;
    }
    if (!sequence) {
      missing.push(wanted.name);
      continue;
    }
    clips.push(
      toThreeClip(psa, sequence, wanted.name, {
        boneNames: body.boneNames,
        rootBone: ROOT_BONE,
        inPlace: wanted.inPlace,
      })
    );
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
  console.log(
    `  ${source.rig}: ${exported.length} pieces, ${clips.length} clips, ` +
      `${Math.round(body.height)} units tall, ${Math.round(glb.byteLength / 1024)} KB -> ${path.basename(outFile)}` +
      (body.adopted.length ? `  (+${body.adopted.length} joints from other pieces)` : "") +
      (body.reattached.length ? `  (attached: ${body.reattached.join(", ")})` : "") +
      (missing.length ? `  (no sequence for ${missing.join("/")})` : "")
  );
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

  for (const rig of rigs) {
    await convertRig(umodel, client, workDir, rig);
  }

  if (!readArg("--work")) await fs.promises.rm(workDir, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
