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

interface PieceSource {
  /** Suffix after the rig name, e.g. "m000_u". */
  suffix: string;
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
  /** Extra pieces beyond BODY_PIECES, or overrides of where one comes from. */
  pieces?: PieceSource[];
}

/** The pieces a body is made of, in the same slots the Unity path uses. */
const BODY_PIECES = ["m000_u", "m000_l", "m000_b", "m000_g", "m000_f", "m000_m00_bh", "m000_m00_ah"];

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
      { suffix: "m000_u", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_l", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_b", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_g", from: { pkg: "Orc", rig: "FOrc" } },
      { suffix: "m000_f" },
      { suffix: "m000_m00_ah" },
    ],
  },
  { rig: "MKamael", pkg: "Kamael", animObject: "MKamael_anim" },
  { rig: "FKamael", pkg: "Kamael", animObject: "FKamael_anim" },
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
}

/**
 * All of a rig's pieces on one skeleton. Unlike the FBX path this needs no
 * bind-pose reconciliation: every piece umodel exports for a rig carries the
 * same skeleton, bone for bone and transform for transform (checked across
 * pieces before this pipeline was written), so the first piece's skeleton is
 * the rig's and the rest contribute only their meshes.
 */
function assemble(pieces: THREE.Group[]): AssembledBody {
  const root = pieces[0];
  const skinned: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(object as THREE.SkinnedMesh);
  });
  if (skinned.length === 0) throw new Error("First piece has no skinned mesh");
  const skeleton = skinned[0].skeleton;

  for (const piece of pieces.slice(1)) {
    const meshes: THREE.SkinnedMesh[] = [];
    piece.traverse((object) => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(object as THREE.SkinnedMesh);
    });
    for (const mesh of meshes) {
      mesh.removeFromParent();
      mesh.bind(skeleton, mesh.bindMatrix);
      skinned[0].parent?.add(mesh);
    }
  }

  const boneNames = new Set(skeleton.bones.map((bone) => THREE.PropertyBinding.sanitizeNodeName(bone.name)));
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  return { root, boneNames, height: (box.max.y - box.min.y) * UNIT_SCALE };
}

async function convertRig(umodel: string, client: string, workDir: string, source: ClientRig): Promise<void> {
  const pieceSources: PieceSource[] = source.pieces ?? BODY_PIECES.map((suffix) => ({ suffix }));
  const exported: string[] = [];

  for (const piece of pieceSources) {
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
    if (fs.existsSync(file)) exported.push(file);
  }
  if (exported.length === 0) throw new Error(`No body pieces found for ${source.rig}`);

  const pieces = await Promise.all(exported.map(loadPiece));
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
        unitScale: UNIT_SCALE,
      })
    );
  }

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
