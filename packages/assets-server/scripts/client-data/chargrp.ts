/**
 * The client's character-appearance table, `system/chargrp.dat`.
 *
 * One record per player rig, in the same order as armorgrp's body slots, and
 * what it holds is exactly what character creation offers: the head meshes for
 * every hair style, the three faces, and the body a rig wears with each
 * equipment slot empty -- each with the texture that belongs on it. It is the
 * client's own answer to questions this pipeline used to take from the package
 * listing, which is not the same thing: a rig publishes head meshes the client
 * never shows.
 *
 * The record layout below was reversed against a High Five client and is exact
 * in the sense that can be checked: reading all seventeen records consumes the
 * decoded table byte for byte, ending on its "SafePackage" trailer. The field
 * *names* come from the structure definitions shipped with L2ClientDat
 * (https://github.com/MobiusDevelopment/l2clientdat), which agree with the
 * layout field for field -- nothing of theirs is copied here, that project is
 * GPL and this one is MIT, but it is the reference to reach for when adding
 * another table.
 */
import { DatReader, readDatFile } from "./l2-dat";

/**
 * Rigs in file order -- the same sixteen, in the same order, as armorgrp's body
 * slots, plus a seventeenth that is empty in every field.
 */
export const CHAR_RIGS = [
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
] as const;

const RECORDS = CHAR_RIGS.length + 1;

/**
 * The hair table: five styles for each of fifteen armour sets, row
 * `style * 15 + set`, because a helmet replaces the head and the table says
 * which one with what. Set 0 is what an unequipped body wears.
 */
const HAIR_STYLES = 5;
const HAIR_SETS = 15;

/**
 * The equipment section is one slot per body part, of which only four are ever
 * filled: the numbering is armorgrp's own `body_part`, where 20 is gloves, 21
 * the torso, 22 the legs and 23 the boots. The client writes the twenty before
 * them and the five after as empty slots, which is 360 and 90 bytes of nothing.
 */
const BODY_SLOTS = 29;
const EQUIPMENT_SLOTS = { gloves: 20, upper: 21, lower: 22, boots: 23 } as const;

export type EquipmentSlot = keyof typeof EQUIPMENT_SLOTS;

/** The eleven weapon-stance voice lists, in file order. */
const VOICE_LISTS = 11;

/** One row of the hair table: a style's head for one armour set. */
export interface HairRow {
  style: number;
  set: number;
  /** The front piece. On its own it is a fringe -- the female fighter's is forty-two vertices. */
  ahMesh: string;
  ahTexture: string;
  /** The head of hair. Whole by itself, which is why the styles that have only this one work. */
  bhMesh: string;
  bhTexture: string;
}

/** What one equipment slot puts on the body when nothing is equipped. */
export interface BodySlot {
  mesh: string[];
  texture: string[];
  /** Extra meshes hung off it -- the Kamael's torso carries their wing here. */
  addMesh: string[];
  addTexture: string[];
  /** One byte per extra mesh; the Kamael's read "w" and "l", for wing and legs. */
  addTags: string;
  addTags2: string;
}

export interface CharRecord {
  rig: string;
  /** 75 rows; the empty ones are dropped. */
  hair: HairRow[];
  face: { mesh: string[]; texture: string[] };
  body: Partial<Record<EquipmentSlot, BodySlot>>;
  attackEffect: string;
  sounds: { attack: string[]; defense: string[]; damage: string[]; voice: string[][] };
  /** Further head meshes and their textures, per record -- where the `m01` hair lives. */
  extra: { mesh: string[]; texture: string[] };
}

function readSlot(reader: DatReader): BodySlot {
  return {
    mesh: reader.list(() => reader.string()).filter(Boolean),
    texture: reader.list(() => reader.string()).filter(Boolean),
    addMesh: reader.list(() => reader.string()).filter(Boolean),
    addTexture: reader.list(() => reader.string()).filter(Boolean),
    addTags: reader.byteList().toString("latin1"),
    addTags2: reader.byteList().toString("latin1"),
  };
}

function readRecord(reader: DatReader, rig: string): CharRecord {
  const hair: HairRow[] = [];
  for (let style = 0; style < HAIR_STYLES; style++) {
    for (let set = 0; set < HAIR_SETS; set++) {
      const row = {
        style,
        set,
        ahMesh: reader.string(),
        ahTexture: reader.string(),
        bhMesh: reader.string(),
        bhTexture: reader.string(),
      };
      if (row.ahMesh || row.bhMesh) hair.push(row);
    }
  }

  const face = {
    mesh: reader.list(() => reader.string()).filter(Boolean),
    texture: reader.list(() => reader.string()).filter(Boolean),
  };

  const slots: BodySlot[] = [];
  for (let index = 0; index < BODY_SLOTS; index++) slots.push(readSlot(reader));
  const body: Partial<Record<EquipmentSlot, BodySlot>> = {};
  for (const [name, index] of Object.entries(EQUIPMENT_SLOTS) as [EquipmentSlot, number][]) {
    const slot = slots[index];
    if (slot.mesh.length || slot.texture.length) body[name] = slot;
  }

  const attackEffect = reader.string();
  reader.i32(); // walk animation frame
  const [attackCount, defenseCount, damageCount] = [reader.i32(), reader.i32(), reader.i32()];
  const take = (count: number): string[] => {
    const items: string[] = [];
    for (let index = 0; index < count; index++) items.push(reader.string());
    return items;
  };
  const sounds = {
    attack: take(attackCount),
    defense: take(defenseCount),
    damage: take(damageCount),
    voice: Array.from({ length: VOICE_LISTS }, () => reader.list(() => reader.string()).filter(Boolean)),
  };

  reader.i32();
  const name = reader.pascalString();
  if (name && name !== rig) {
    throw new Error(`chargrp: record for ${rig} closes with the name ${JSON.stringify(name)}`);
  }
  reader.i32();
  reader.i32();
  reader.i32();
  const extra = {
    mesh: reader.list(() => reader.string()).filter(Boolean),
    texture: reader.list(() => reader.string()).filter(Boolean),
  };

  return { rig, hair, face, body, attackEffect, sounds, extra };
}

/**
 * Every rig's appearance table.
 *
 * Throws rather than returning a partial read: a table that does not end
 * exactly where it should has been parsed with the wrong shape somewhere, and
 * every name it produced after that point is suspect.
 */
export function readChargrp(file: string): CharRecord[] {
  const data = readDatFile(file);
  const reader = new DatReader(data);
  const records: CharRecord[] = [];
  for (let index = 0; index < RECORDS; index++) {
    const rig = CHAR_RIGS[index] ?? "";
    try {
      const record = readRecord(reader, rig);
      if (rig) records.push(record);
    } catch (error) {
      throw new Error(
        `chargrp record ${index} (${rig || "spare"}) did not parse at byte ${reader.offset}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const trailer = reader.rest;
  if (trailer.subarray(1).toString("latin1") !== "SafePackage\0") {
    throw new Error(`chargrp: ${trailer.length} bytes left over after ${RECORDS} records`);
  }
  return records;
}

/**
 * The head pieces each style puts on a character wearing no armour.
 *
 * A style is not one mesh. Its row for the starting set holds an `ah` piece and
 * a `bh` one, and the client draws whichever are filled. The human fighter's
 * first style fills both, and it has to: her `ah` is a forty-two vertex fringe
 * across the front of the head, so drawn alone it leaves her bald.
 */
export function bareHeads(record: CharRecord): { mesh: string; texture: string }[][] {
  return Array.from({ length: HAIR_STYLES }, (_, style) => {
    const row = record.hair.find((candidate) => candidate.style === style && candidate.set === 0);
    if (!row) return [];
    return [
      { mesh: row.ahMesh, texture: row.ahTexture },
      { mesh: row.bhMesh, texture: row.bhTexture },
    ].filter((piece) => piece.mesh);
  });
}

/** Splits a `Package.Object` name, as the client writes them in this table. */
export function splitObjectName(name: string): { pkg: string; object: string } {
  const dot = name.indexOf(".");
  return dot < 0 ? { pkg: "", object: name } : { pkg: name.slice(0, dot), object: name.slice(dot + 1) };
}
