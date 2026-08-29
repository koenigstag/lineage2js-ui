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
 * The hair table, seventy-five rows of `[mode][page][style]`.
 *
 * The fast axis is the hair style, five to a page, and the pages continue one
 * rig's list: every rig fills page 0 with m000..m004, and the female rigs fill
 * two more slots on page 1, which is why creation offers them seven styles and
 * the male rigs five. A style index is therefore `page * 5 + style`.
 *
 * The slow axis is what the head is currently wearing. Mode 0 is a bare head
 * and the only one creation shows; mode 1 is the same five styles with the
 * front piece dropped, for a helmet that covers the forehead; modes 2 and 3
 * replace the hair outright with one head for every style (m009 and m008 on
 * the human fighter). Mode 4 is empty in this client.
 *
 * The mode numbering is observed rather than documented -- what picks between
 * them is a property of the equipped helmet, which nothing here reads yet.
 */
const HAIR_MODES = 5;
const HAIR_PAGES = 3;
const HAIR_PAGE_STYLES = 5;

/** Bare-headed: the mode whose styles are the list character creation offers. */
const HAIR_MODE_BARE = 0;

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

/** One row of the hair table: one style's head, in one wearing mode. */
export interface HairRow {
  /** `page * 5 + style` -- what creation calls the hairstyle, 0-based. */
  style: number;
  /** Which head this row is for: 0 bare, 1 fringe dropped, 2 and 3 replaced. See HAIR_MODES. */
  mode: number;
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
  /**
   * A tail of further head meshes and textures, filled on four rigs only.
   * What lands here is `_u` variants of a style and the `m01` texture set for
   * the replaced heads -- the lists are not the same length and do not pair
   * up, so nothing reads it yet.
   */
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
  for (let mode = 0; mode < HAIR_MODES; mode++) {
    for (let page = 0; page < HAIR_PAGES; page++) {
      for (let index = 0; index < HAIR_PAGE_STYLES; index++) {
        const row = {
          style: page * HAIR_PAGE_STYLES + index,
          mode,
          ahMesh: reader.string(),
          ahTexture: reader.string(),
          bhMesh: reader.string(),
          bhTexture: reader.string(),
        };
        if (row.ahMesh || row.bhMesh) hair.push(row);
      }
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
 * The hair styles character creation offers, in its own order.
 *
 * Only the bare-headed mode: the other modes hold the same styles as a helmet
 * leaves them, which is not a choice anyone makes on this screen.
 *
 * A style is not one mesh. Its row holds an `ah` piece and a `bh` one and the
 * client draws whichever are filled -- most styles fill both, where the `ah` is
 * a fringe of a few dozen vertices over the head of hair beneath it, so drawing
 * the pieces of a style is not optional. The orcs and the shamans fill only
 * `bh`, in every style they have.
 *
 * The length is the rig's own: five for the male rigs, seven for the female
 * ones, which is what the client's own screen offers.
 */
export function bareHeads(record: CharRecord): { mesh: string; texture: string }[][] {
  const bare = record.hair
    .filter((row) => row.mode === HAIR_MODE_BARE)
    .sort((left, right) => left.style - right.style);
  const offered = new Set<string>();
  return bare
    .filter((row) => {
      // A row whose leading mesh is one already offered is that same style
      // behind a different back piece, not another entry on the list. The
      // female Kamael's eighth row repeats her seventh's `ah` with a `_u`
      // variant behind it, and the client offers her seven; hers is the only
      // repeat in the whole table, on any rig.
      //
      // It is also the last row, so dropping it moves nothing. A repeat in the
      // middle would renumber the styles after it -- and the style index is
      // what the wire carries -- so that case wants looking at rather than
      // assuming this rule still holds.
      const leading = row.ahMesh || row.bhMesh;
      if (offered.has(leading)) return false;
      offered.add(leading);
      return true;
    })
    .map((row) =>
      [
        { mesh: row.ahMesh, texture: row.ahTexture },
        { mesh: row.bhMesh, texture: row.bhTexture },
      ].filter((piece) => piece.mesh)
    );
}

/** Splits a `Package.Object` name, as the client writes them in this table. */
export function splitObjectName(name: string): { pkg: string; object: string } {
  const dot = name.indexOf(".");
  return dot < 0 ? { pkg: "", object: name } : { pkg: name.slice(0, dot), object: name.slice(dot + 1) };
}
