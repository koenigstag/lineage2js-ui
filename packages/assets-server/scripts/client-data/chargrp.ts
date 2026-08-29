/**
 * The client's character-appearance table, `system/chargrp.dat`.
 *
 * One record per player rig, in the same order as armorgrp's body slots, and
 * the part worth having is what character creation offers: the head meshes for
 * each hair style and the three faces, each with the texture that belongs on
 * it. This is the client's own answer to a question the model pipeline had
 * been getting from the package listing -- and getting wrong, because a rig
 * publishes head meshes it never shows.
 *
 * **Only part of the record is decoded.** The hair and face sections read
 * exactly; the equipment, effect and sound sections that follow them do not
 * yet, so this skips to the next record instead of parsing through. That is
 * safe because the split does not depend on them: every record ends with its
 * rig's name written as a length-prefixed ASCII string (`09 "MFighter" 00`),
 * the same kind of marker that closes armorgrp, and those are found by
 * scanning the whole file. Where the next record begins after one is settled
 * by parsing forward: exactly one offset yields 150 clean hair pairs followed
 * by a face list, which is a strong enough shape that a wrong guess cannot
 * satisfy it.
 *
 * Do not "fix" this by loosening the checks. The one thing worse than an
 * incomplete reader here is one that quietly returns plausible nonsense.
 */
import { DatReader, readDatFile } from "./l2-dat";

/** Rigs in file order -- the same sixteen, in the same order, as armorgrp's body slots. */
const RIG_NAMES = [
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

/**
 * The hair table's shape: five styles, each with a slot per armour set,
 * because a helmet replaces the head mesh and the table says which one with
 * what.
 */
const HAIR_STYLES = 5;
const HAIR_SLOTS = 30;

export interface HairEntry {
  /** Which of the style's slots this is; low ones are the sets a new character wears. */
  slot: number;
  mesh: string;
  texture: string;
}

export interface CharRecord {
  rig: string;
  /** Five styles, each listing only the slots the client filled. */
  hair: HairEntry[][];
  face: { mesh: string[]; texture: string[] };
  /** Where the record sits in the decoded table, for anyone checking this against the bytes. */
  at: number;
}

/** A record ends with its rig's name as `<len> <ascii> 00`. */
function nameMarkerAt(data: Buffer, at: number): string | undefined {
  const length = data[at];
  if (length < 4 || length > 20 || at + length >= data.length) return undefined;
  if (data[at + length] !== 0) return undefined;
  const text = data.subarray(at + 1, at + length).toString("latin1");
  if (!/^[A-Za-z]+$/.test(text)) return undefined;
  return RIG_NAMES.includes(text as (typeof RIG_NAMES)[number]) ? text : undefined;
}

function readHairAndFace(data: Buffer, at: number): Omit<CharRecord, "rig"> | undefined {
  const reader = new DatReader(data.subarray(at));
  const hair: HairEntry[][] = [];
  try {
    for (let style = 0; style < HAIR_STYLES; style++) {
      const entries: HairEntry[] = [];
      for (let slot = 0; slot < HAIR_SLOTS; slot++) {
        const mesh = reader.string();
        const texture = reader.string();
        if (mesh || texture) entries.push({ slot, mesh, texture });
      }
      hair.push(entries);
    }
    const mesh = reader.list(() => reader.string());
    const texture = reader.list(() => reader.string());
    // The face list is the anchor: three meshes whose names end in `_f`.
    if (mesh.length === 0 || !mesh[0].toLowerCase().endsWith("_f")) return undefined;
    return { hair, face: { mesh, texture }, at };
  } catch {
    return undefined;
  }
}

/** Every rig's appearance table, in file order. */
export function readChargrp(file: string): CharRecord[] {
  const data = readDatFile(file);

  const markers: number[] = [];
  for (let at = 0; at < data.length - 34; at++) {
    if (nameMarkerAt(data, at)) markers.push(at);
  }
  if (markers.length !== RIG_NAMES.length) {
    throw new Error(`chargrp: found ${markers.length} rig-name markers, expected ${RIG_NAMES.length}`);
  }

  const records: CharRecord[] = [];
  let start = 0;
  for (let index = 0; index < markers.length; index++) {
    const parsed = readHairAndFace(data, start);
    if (!parsed) throw new Error(`chargrp: record ${index} does not begin at byte ${start}`);
    records.push({ rig: nameMarkerAt(data, markers[index])!, ...parsed });

    if (index + 1 >= markers.length) break;
    // The next record begins somewhere after this one's name; only one offset
    // makes a whole hair table and a face list fall out.
    const after = markers[index] + 1 + data[markers[index]];
    let next: number | undefined;
    for (let skip = 0; skip < 800 && next === undefined; skip += 2) {
      if (readHairAndFace(data, after + skip)) next = after + skip;
    }
    if (next === undefined) {
      throw new Error(`chargrp: no record start found after the ${records[index].rig} marker at byte ${markers[index]}`);
    }
    start = next;
  }
  return records;
}

/**
 * The head each style puts on a character wearing no armour: the first slot
 * the style fills.
 *
 * Called "first" rather than "unarmoured" deliberately -- what the slot index
 * counts is not yet established, only that the low ones hold the starting
 * sets. For every rig this picks out the same four heads the creation screen
 * offers, with the fifth style empty throughout.
 */
export function bareHeads(record: CharRecord): (HairEntry | undefined)[] {
  return record.hair.map((style) => style[0]);
}
