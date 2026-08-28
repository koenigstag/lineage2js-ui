/**
 * Reads the animation format umodel exports L2's MeshAnimation objects to
 * (PSA), and rewrites its sequences into three.js clips.
 *
 * PSA and PSK share one container: 32-byte chunk headers (a 20-byte id, then
 * the per-entry size and count) followed by that many fixed-size records.
 * Only three chunks matter here -- the bone list, the sequence table, and the
 * keys themselves.
 *
 * The frame this converts out of is the client's own, and the mapping into
 * three's was derived rather than assumed: umodel exports the same skeletal
 * mesh both as PSK (client frame, the one the keys are in) and as glTF
 * (already converted), so scoring every axis permutation of the former
 * against the latter finds the one that reproduces it. Across all 76 bones of
 * the orc rig exactly one mapping matches, to zero error --
 * (x, z, -y) with a 0.01 scale for positions, the same axis swap for the
 * quaternion's vector part, and every bone but the root conjugated.
 */
import * as THREE from "three";
import fs from "node:fs";

/**
 * Positions come out of the client at 100x the scale umodel's glTF export uses.
 *
 * This is the only conversion the keys need. A rig whose units are restored
 * by scaling its root node -- which is how convert-client-rigs.ts does it --
 * gets that factor applied to the whole tree at render time, this track
 * included, so folding it in here as well would apply it twice and fling the
 * body a hundred body-heights into the air.
 */
const POSITION_SCALE = 0.01;

interface Chunk {
  body: Buffer;
  size: number;
  count: number;
}

function readChunks(file: string): Map<string, Chunk> {
  const data = fs.readFileSync(file);
  const chunks = new Map<string, Chunk>();
  let offset = 0;
  while (offset + 32 <= data.length) {
    const id = data.subarray(offset, offset + 20).toString("latin1").split("\0")[0];
    const size = data.readInt32LE(offset + 24);
    const count = data.readInt32LE(offset + 28);
    offset += 32;
    chunks.set(id, { body: data.subarray(offset, offset + size * count), size, count });
    offset += size * count;
  }
  return chunks;
}

export interface PsaSequence {
  /** Sequence name as the client has it, e.g. "Wait_Hand_MOrc". */
  name: string;
  frames: number;
  /** Frames per second this sequence was authored at -- its own, not a global one. */
  rate: number;
  firstRawFrame: number;
}

export interface PsaFile {
  boneNames: string[];
  sequences: PsaSequence[];
  /** Raw key store, indexed [frame * boneCount + bone]. */
  keys: { position: [number, number, number]; rotation: [number, number, number, number] }[];
}

export function readPsa(file: string): PsaFile {
  const chunks = readChunks(file);
  const boneChunk = chunks.get("BONENAMES");
  const infoChunk = chunks.get("ANIMINFO");
  const keyChunk = chunks.get("ANIMKEYS");
  if (!boneChunk || !infoChunk || !keyChunk) {
    throw new Error(`${file} is missing one of BONENAMES/ANIMINFO/ANIMKEYS`);
  }

  const boneNames: string[] = [];
  for (let i = 0; i < boneChunk.count; i++) {
    const entry = boneChunk.body.subarray(i * boneChunk.size, (i + 1) * boneChunk.size);
    boneNames.push(entry.subarray(0, 64).toString("latin1").split("\0")[0]);
  }

  const sequences: PsaSequence[] = [];
  for (let i = 0; i < infoChunk.count; i++) {
    const entry = infoChunk.body.subarray(i * infoChunk.size, (i + 1) * infoChunk.size);
    sequences.push({
      name: entry.subarray(0, 64).toString("latin1").split("\0")[0],
      rate: entry.readFloatLE(152),
      firstRawFrame: entry.readInt32LE(160),
      frames: entry.readInt32LE(164),
    });
  }

  const keys: PsaFile["keys"] = [];
  for (let i = 0; i < keyChunk.count; i++) {
    const entry = keyChunk.body.subarray(i * keyChunk.size, (i + 1) * keyChunk.size);
    keys.push({
      position: [entry.readFloatLE(0), entry.readFloatLE(4), entry.readFloatLE(8)],
      rotation: [entry.readFloatLE(12), entry.readFloatLE(16), entry.readFloatLE(20), entry.readFloatLE(24)],
    });
  }

  return { boneNames, sequences, keys };
}

export interface ClipOptions {
  /** Keeps a locomotion cycle in place -- world position comes from the server. */
  inPlace?: boolean;
  /** Bone names present on the rig being animated; curves for anything else are dropped. */
  boneNames: Set<string>;
  /** The rig's root bone -- the only one whose translation is kept, see below. */
  rootBone: string;
  /** Applied to the root's translation, for a rig driven by another's clip. */
  rootMotionScale?: number;
}

/**
 * One PSA sequence as a three.js clip, at the duration the client authored it
 * for -- frames / its own rate. Nothing has to be retimed afterwards the way
 * the Unity path does (see convert-unity-models.ts's AUTHORED_SECONDS): that
 * table exists to restore a number this format simply carries.
 */
export function toThreeClip(psa: PsaFile, sequence: PsaSequence, name: string, options: ClipOptions): THREE.AnimationClip {
  const boneCount = psa.boneNames.length;
  const tracks: THREE.KeyframeTrack[] = [];
  const scale = POSITION_SCALE;

  for (let bone = 0; bone < boneCount; bone++) {
    const boneName = THREE.PropertyBinding.sanitizeNodeName(psa.boneNames[bone]);
    if (!options.boneNames.has(boneName)) continue;

    const isRoot = bone === 0;
    const times: number[] = [];
    const rotations: number[] = [];
    const positions: number[] = [];
    let previous: [number, number, number, number] | null = null;

    for (let frame = 0; frame < sequence.frames; frame++) {
      const key = psa.keys[(sequence.firstRawFrame + frame) * boneCount + bone];
      if (!key) break;
      times.push(frame / sequence.rate);

      const [qx, qy, qz, qw] = key.rotation;
      // Axis swap plus the conjugation every bone but the root needs.
      const sign = isRoot ? 1 : -1;
      let converted: [number, number, number, number] = [sign * qx, sign * qz, -sign * qy, qw];
      // q and -q are the same rotation but interpolate the long way round
      // against a neighbour of the opposite sign.
      if (previous && previous[0] * converted[0] + previous[1] * converted[1] + previous[2] * converted[2] + previous[3] * converted[3] < 0) {
        converted = [-converted[0], -converted[1], -converted[2], -converted[3]];
      }
      previous = converted;
      rotations.push(...converted);

      if (isRoot) {
        const [px, py, pz] = key.position;
        positions.push(px * scale, pz * scale, -py * scale);
      }
    }

    if (times.length === 0) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, rotations));

    // Every other bone's translation only ever encodes bone lengths, which
    // belong to the rig and not to the clip -- keeping them would stamp one
    // body's proportions onto whichever borrows the animation.
    if (isRoot && positions.length > 0) {
      const motion = options.rootMotionScale ?? 1;
      const first = positions.slice(0, 3);
      const values: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        const x = options.inPlace ? first[0] : positions[i];
        const z = options.inPlace ? first[2] : positions[i + 2];
        values.push(x * motion, positions[i + 1] * motion, z * motion);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values));
    }
  }

  const clip = new THREE.AnimationClip(name, sequence.frames / sequence.rate, tracks);
  return clip;
}
