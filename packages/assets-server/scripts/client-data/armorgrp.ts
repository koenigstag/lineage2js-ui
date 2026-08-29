/**
 * The client's armour table, `system/armorgrp.dat`.
 *
 * One record per armour item, and the part worth having is the body table
 * inside it: for each of the sixteen player rigs, the mesh that item puts on
 * that body and the texture that goes on the mesh. That is the client's own
 * answer to the question this pipeline used to guess at -- which set and which
 * texture id dress a given rig's torso, legs, boots and gloves.
 *
 * The schema below was reversed against a High Five client and is exact in the
 * only sense that can be checked without a specification: reading it consumes
 * all 3650 records and lands precisely on the trailing "SafePackage" marker,
 * with nothing left over. Fields whose meaning is not established are kept as
 * numbers under `unknown` rather than given names they might not deserve --
 * item stats (weight, defence, crystal type) are certainly among them.
 *
 * Two shapes here are easy to misread and cost time if you do:
 *
 * - `icons` and the drop mesh/texture are *fixed-size* arrays whose unused
 *   slots are empty strings, not count-prefixed lists. Five icon slots, three
 *   drop meshes, nine drop textures.
 * - the per-rig `attach` entries carry a two-byte tag after each mesh name.
 *   These are the extra pieces an item hangs off the body -- for the Kamael's
 *   default torso, their wing.
 */
import { DatReader, readDatFile } from "./l2-dat";

/**
 * The body table's slots, in file order.
 *
 * Sixteen rigs and one spare that is empty in every record. The names match
 * the rig names this repo's model pipeline uses, which is not a coincidence:
 * both come from the client's own package names.
 */
export const BODY_SLOTS = [
  "MFighter",
  "FFighter",
  "MDarkElf",
  "FDarkElf",
  "MDwarf",
  "FDwarf",
  "MElf",
  "FElf",
  "MMagic",
  "FMagic",
  "MOrc",
  "FOrc",
  "MShaman",
  "FShaman",
  "MKamael",
  "FKamael",
  "spare",
] as const;

/** What one item puts on one rig. Names are `Package.Object`, as umodel wants them. */
export interface ArmorBody {
  mesh: string[];
  texture: string[];
  /** Extra meshes hung off the body -- the Kamael wing is one. */
  attach?: string[];
  attachTexture?: string[];
  /** A second texture for the same mesh, where the item has one. */
  extraTexture?: string;
}

export interface ArmorRecord {
  id: number;
  icons: string[];
  /** The overlay stamped on the icon, e.g. `icon.time_tab` on a timed item. */
  overlayIcon?: string;
  /** Minutes the item survives, or -1 for one that does not expire. */
  timeLimit: number;
  quests: number[];
  drop: { mesh: string[]; texture: string[] };
  effect?: string;
  sounds: { hit: string[]; drop?: string; equip?: string };
  /** Keyed by rig name; slots the item does not dress are absent. */
  body: Partial<Record<string, ArmorBody>>;
  /** Fields whose meaning has not been established, kept rather than dropped. */
  unknown: { head: number[]; afterDrop: number[]; mid: number[]; tail: number[] };
}

function readRecord(reader: DatReader): ArmorRecord {
  const head = reader.skip(7);
  const dropMesh = reader.strings(3);
  const dropTexture = reader.strings(9);
  const afterDrop = reader.skip(3);
  const icons = reader.strings(5);
  const timeLimit = reader.i32();
  const mid = reader.skip(4);
  const quests = reader.list(() => reader.i32());
  mid.push(reader.i32());
  const overlayIcon = reader.string();
  mid.push(reader.u32());

  const body: Partial<Record<string, ArmorBody>> = {};
  for (const slot of BODY_SLOTS) {
    const mesh = reader.list(() => reader.string()).filter(Boolean);
    const texture = reader.list(() => reader.string()).filter(Boolean);
    const attach = reader
      .list(() => {
        const name = reader.string();
        reader.u16();
        return name;
      })
      .filter(Boolean);
    const attachTexture = reader.list(() => reader.string()).filter(Boolean);
    const extraTexture = reader.string();
    if (mesh.length || texture.length || attach.length || attachTexture.length || extraTexture) {
      body[slot] = {
        mesh,
        texture,
        ...(attach.length ? { attach } : {}),
        ...(attachTexture.length ? { attachTexture } : {}),
        ...(extraTexture ? { extraTexture } : {}),
      };
    }
  }

  const effect = reader.string();
  const hit = reader.list(() => reader.string()).filter(Boolean);
  const dropSound = reader.string();
  const equipSound = reader.string();
  const tail = reader.skip(9);

  return {
    id: head[1],
    icons,
    ...(overlayIcon ? { overlayIcon } : {}),
    timeLimit,
    quests,
    drop: { mesh: dropMesh, texture: dropTexture },
    ...(effect ? { effect } : {}),
    sounds: { hit, ...(dropSound ? { drop: dropSound } : {}), ...(equipSound ? { equip: equipSound } : {}) },
    body,
    unknown: { head, afterDrop, mid, tail },
  };
}

/** Every record in the table, in file order. */
export function readArmorgrp(file: string): ArmorRecord[] {
  const reader = new DatReader(readDatFile(file));
  const count = reader.u32();
  const records: ArmorRecord[] = [];
  for (let index = 0; index < count; index++) {
    try {
      records.push(readRecord(reader));
    } catch (error) {
      throw new Error(
        `armorgrp record ${index} of ${count} did not parse at byte ${reader.offset}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  // The table ends with a length-prefixed "SafePackage"; anything else means
  // the schema drifted somewhere and every record after it is suspect.
  const trailer = reader.rest;
  if (trailer.subarray(1).toString("latin1") !== "SafePackage\0") {
    throw new Error(`armorgrp: ${trailer.length} bytes left over after ${count} records`);
  }
  return records;
}

/** The four equipment slots a body has, by the letter the client names them with. */
export const ARMOR_SLOT_LETTERS = { upper: "u", lower: "l", boots: "b", gloves: "g" } as const;

export type ArmorSlot = keyof typeof ARMOR_SLOT_LETTERS;

/**
 * What each rig wears with that slot empty.
 *
 * The client models bare skin as an item like any other, and finds it by
 * icon: `icon.armor_t02_<letter>_i00` is the empty-slot entry for the torso,
 * legs, boots and gloves. Reading it off the icon rather than hard-coding the
 * four item ids keeps this honest -- and the table holds later copies of the
 * boots entry (event items) whose Kamael texture differs, so the first match
 * wins.
 */
export function bareBodies(records: ArmorRecord[]): Record<ArmorSlot, Partial<Record<string, ArmorBody>>> {
  const bare = {} as Record<ArmorSlot, Partial<Record<string, ArmorBody>>>;
  for (const [slot, letter] of Object.entries(ARMOR_SLOT_LETTERS) as [ArmorSlot, string][]) {
    const icon = `icon.armor_t02_${letter}_i00`;
    const record = records.find((candidate) => candidate.icons.includes(icon));
    if (!record) throw new Error(`armorgrp has no empty-slot entry for ${slot} (looked for ${icon})`);
    bare[slot] = record.body;
  }
  return bare;
}

/** Splits a `Package.Object` name, as the client writes them in this table. */
export function splitObjectName(name: string): { pkg: string; object: string } {
  const dot = name.indexOf(".");
  return dot < 0 ? { pkg: "", object: name } : { pkg: name.slice(0, dot), object: name.slice(dot + 1) };
}
