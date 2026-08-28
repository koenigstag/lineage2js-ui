/**
 * Converts the character rigs of the Unity L2J client
 * (https://github.com/gawric/Unity-Client-for-L2J) into one glTF binary per
 * race/sex body, animations included, for the web client to load at runtime.
 *
 * The Unity project keeps a body as a handful of FBX pieces sharing one bind
 * pose, and its animations as separate Unity `.anim` YAML assets; neither is
 * something a browser can load. This script merges the pieces onto a single
 * skeleton, rewrites the clips into three.js's coordinate frame (see
 * models/unity-clip-to-three.ts for how that transform was pinned down), and
 * writes `<rig>.glb`.
 *
 * Six of the ten rigs ship only a handful of clips of their own, so anything
 * missing is borrowed from the richest rig of the same sex. That works because
 * every player rig here is the same 3ds Max biped with the same bone names, and
 * because only rotation is retargeted -- the borrowing rig keeps its own
 * proportions (see toThreeClip).
 *
 * Orcs and Kamael have no models in the Unity project at all; the web client
 * falls back to its placeholder body for those (see character-models.ts).
 *
 * The output is derived from NCsoft's copyrighted client art and must never be
 * committed -- it lands under assets/, covered by its blanket .gitignore, same
 * policy as the real icons and geodata.
 *
 * Run with:
 *   pnpm --filter @lineage2js/assets-server convert:models -- --unity <checkout>
 * or set UNITY_CLIENT_DIR to the checkout instead of passing --unity.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { assembleBody, type BodyPart } from "./models/fbx-body";
import { readUnityAnimationClip } from "./models/unity-anim";
import { toThreeClip } from "./models/unity-clip-to-three";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GLTFExporter reads its assembled Blob back through a FileReader, which node
// has no equivalent of. Only readAsArrayBuffer is ever used, and the exporter
// assigns onloadend after the call, so the shim has to hand the result back on
// a later tick -- which Blob.arrayBuffer() does for free.
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

const OUT_DIR = path.join(__dirname, "../assets/highfive/models");
const ANIMATIONS_SUBPATH = "l2-unity/Assets/Resources/Data/Animations";

/** The topmost bone of every player rig -- 3ds Max biped naming, shared by all ten. */
const ROOT_BONE = "bip01";

interface RigSource {
  /** File/folder name of the rig, e.g. "MFighter". */
  rig: string;
  /** Animation package folder holding it, e.g. "Fighter". */
  pkg: string;
  /** Rig to borrow any missing clip from -- always the same sex. */
  donor?: string;
}

// Human fighters and mystics are genuinely different bodies in the retail art
// (MFighter/MMagic); every other race has one body per sex regardless of class.
const RIGS: RigSource[] = [
  { rig: "MFighter", pkg: "Fighter" },
  { rig: "FFighter", pkg: "Fighter", donor: "FDarkElf" },
  { rig: "MMagic", pkg: "Magic" },
  { rig: "FMagic", pkg: "Magic", donor: "FDarkElf" },
  { rig: "MElf", pkg: "Elf", donor: "MFighter" },
  { rig: "FElf", pkg: "Elf", donor: "FDarkElf" },
  { rig: "MDarkElf", pkg: "DarkElf", donor: "MFighter" },
  { rig: "FDarkElf", pkg: "DarkElf" },
  { rig: "MDwarf", pkg: "Dwarf", donor: "MFighter" },
  { rig: "FDwarf", pkg: "Dwarf" },
];

const PKG_BY_RIG = new Map(RIGS.map((source) => [source.rig, source.pkg]));

interface ClipSource {
  /** Clip name in the exported glTF, matched by name in the client. */
  name: string;
  /** Unity clip base names to try, best first (lowercased for matching). */
  candidates: string[];
  /** Locomotion cycles play in place -- the server drives world position. */
  inPlace?: boolean;
}

// The four states the client can actually drive from what it knows about a
// creature (see CreatureModel's animationFor). Every rig ships plenty more --
// attacks, casting, sitting, social poses -- and adding one here is enough to
// export it, but an unused clip is just weight in a file every player fetches.
//
// The unarmed ("Hand") variants throughout: no weapon is rendered yet, and the
// armed variants pose the hands around a weapon that isn't there.
const CLIPS: ClipSource[] = [
  { name: "idle", candidates: ["wait_hand", "wait_1hs"] },
  { name: "walk", candidates: ["walk_hand", "walk_1hs"], inPlace: true },
  { name: "run", candidates: ["run_hand", "run_1hs"], inPlace: true },
  { name: "death", candidates: ["death"] },
];

/** m000 is the bare default set every rig ships; higher numbers are armor. */
const BODY_PART_SUFFIXES: { suffixes: string[]; slot: BodyPart["slot"] }[] = [
  { suffixes: ["m000_u"], slot: "outfit" },
  { suffixes: ["m000_l", "m000_i"], slot: "outfit" },
  { suffixes: ["m000_b"], slot: "outfit" },
  { suffixes: ["m000_g"], slot: "skin" },
  { suffixes: ["m000_f"], slot: "skin" },
  { suffixes: ["m000_m00_bh", "m000_m00_ah"], slot: "hair" },
];

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Unity's asset folders mix `_i` and `_I` for the same part, so match on case-folded names. */
function findFile(dir: string, wanted: string): string | undefined {
  const entries = fs.readdirSync(dir);
  const match = entries.find((entry) => entry.toLowerCase() === wanted.toLowerCase());
  return match ? path.join(dir, match) : undefined;
}

function resolveBodyParts(modelsDir: string, rig: string): BodyPart[] {
  const parts: BodyPart[] = [];
  for (const { suffixes, slot } of BODY_PART_SUFFIXES) {
    let file: string | undefined;
    for (const suffix of suffixes) {
      file = findFile(modelsDir, `${rig}_${suffix}.fbx`);
      if (file) break;
    }
    if (file) parts.push({ file, slot });
    else console.warn(`  ${rig}: no ${suffixes[0]} piece, body will be missing it`);
  }
  return parts;
}

/** Clip files are named `<rig>_m000_b.ao_<base>_<rig>.anim`; index them by `<base>`. */
function indexClips(clipsDir: string, rig: string): Map<string, string> {
  const index = new Map<string, string>();
  if (!fs.existsSync(clipsDir)) return index;
  for (const entry of fs.readdirSync(clipsDir)) {
    if (!entry.endsWith(".anim")) continue;
    const base = entry
      .replace(/\.anim$/, "")
      .replace(/^.*?\.ao_/, "")
      .replace(new RegExp(`_${rig}$`, "i"), "")
      .toLowerCase();
    if (!index.has(base)) index.set(base, path.join(clipsDir, entry));
  }
  return index;
}

// Assembled body heights, so a rig borrowing another's clips can scale their
// root motion to its own size -- and so the two donor rigs are only assembled
// once between them.
const heightByRig = new Map<string, number>();

function rigHeight(unityDir: string, rig: string, pkg: string): number {
  const known = heightByRig.get(rig);
  if (known !== undefined) return known;
  const modelsDir = path.join(unityDir, ANIMATIONS_SUBPATH, pkg, rig, "Models");
  const height = assembleBody(resolveBodyParts(modelsDir, rig)).height;
  heightByRig.set(rig, height);
  return height;
}

async function convertRig(unityDir: string, source: RigSource): Promise<void> {
  const rigDir = path.join(unityDir, ANIMATIONS_SUBPATH, source.pkg, source.rig);
  const parts = resolveBodyParts(path.join(rigDir, "Models"), source.rig);
  if (parts.length === 0) throw new Error(`No body pieces found under ${rigDir}/Models`);

  const body = assembleBody(parts);
  const ownClips = indexClips(path.join(rigDir, "Clips"), source.rig);

  heightByRig.set(source.rig, body.height);

  let donorClips = new Map<string, string>();
  let donorHeight = body.height;
  if (source.donor) {
    const donorPkg = PKG_BY_RIG.get(source.donor);
    if (!donorPkg) throw new Error(`Unknown donor rig ${source.donor}`);
    const donorDir = path.join(unityDir, ANIMATIONS_SUBPATH, donorPkg, source.donor);
    donorClips = indexClips(path.join(donorDir, "Clips"), source.donor);
    donorHeight = rigHeight(unityDir, source.donor, donorPkg);
  }

  const clips: THREE.AnimationClip[] = [];
  const borrowed: string[] = [];
  for (const wanted of CLIPS) {
    let file: string | undefined;
    let rootMotionScale = 1;
    for (const candidate of wanted.candidates) {
      file = ownClips.get(candidate);
      if (file) break;
    }
    if (!file) {
      for (const candidate of wanted.candidates) {
        file = donorClips.get(candidate);
        if (file) break;
      }
      if (file) {
        borrowed.push(wanted.name);
        rootMotionScale = donorHeight === 0 ? 1 : body.height / donorHeight;
      }
    }
    if (!file) continue;

    clips.push(
      toThreeClip(
        wanted.name,
        readUnityAnimationClip(file),
        { boneNames: body.boneNames, rootBone: ROOT_BONE, unityScale: body.unityScale, rootMotionScale },
        { inPlace: wanted.inPlace }
      )
    );
  }

  const glb = (await new GLTFExporter().parseAsync(body.root, {
    binary: true,
    animations: clips,
    // Nothing here is textured yet, and the exporter's image path needs a DOM.
    embedImages: false,
  })) as ArrayBuffer;

  const outFile = path.join(OUT_DIR, `${source.rig.toLowerCase()}.glb`);
  await fs.promises.writeFile(outFile, Buffer.from(glb));
  console.log(
    `  ${source.rig}: ${parts.length} pieces, ${clips.length} clips` +
      `${borrowed.length ? ` (${borrowed.join("/")} from ${source.donor})` : ""}` +
      `${body.offPose.length ? `, ignored the skeleton in ${body.offPose.join("/")}` : ""}` +
      `, ${(glb.byteLength / 1024).toFixed(0)} KB -> ${path.basename(outFile)}`
  );
}

async function main(): Promise<void> {
  const unityDir = readArg("--unity") ?? process.env.UNITY_CLIENT_DIR;
  if (!unityDir || !fs.existsSync(path.join(unityDir, ANIMATIONS_SUBPATH))) {
    console.error(
      "Point --unity (or UNITY_CLIENT_DIR) at a checkout of https://github.com/gawric/Unity-Client-for-L2J\n" +
        `-- expected to find ${ANIMATIONS_SUBPATH} inside it.`
    );
    process.exitCode = 1;
    return;
  }

  const only = readArg("--only");
  const rigs = only ? RIGS.filter((source) => source.rig.toLowerCase() === only.toLowerCase()) : RIGS;
  if (rigs.length === 0) {
    console.error(`No rig named "${only}". Known rigs: ${RIGS.map((source) => source.rig).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  console.log(`Converting ${rigs.length} rig(s) into ${OUT_DIR}`);
  for (const source of rigs) {
    await convertRig(unityDir, source);
  }
}

void main();
