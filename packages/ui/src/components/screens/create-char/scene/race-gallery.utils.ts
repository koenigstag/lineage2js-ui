import { RACES, SEXES, getAvailableBaseClasses, type PlayerVariant, type RaceNames } from "../../../../config/character-races";
import { CLIENT_DATA_CORRECTION } from "../../../../utils/models/character-model";

// Same shape as PlayerVariant -- kept as its own name since it's specifically
// what RACE_GALLERY enumerates, not every caller with a player variant on
// hand. colorForVariant/getPlayerVisualFromVariant now live in
// character-races.ts (shared by char-select/CreatureModel's player branch
// too, not just this gallery).
export type GalleryVariant = PlayerVariant;

/** Where one body stands and which way it looks, in the group's own space. */
export interface GallerySlot {
  x: number;
  z: number;
  /** Yaw for PlayerModel's angleToCenter: 0 looks straight at the camera. */
  yaw: number;
}

export interface GalleryGroup {
  race: RaceNames;
  variants: GalleryVariant[];
  /** One per variant, in the same order. */
  slots: GallerySlot[];
}

/**
 * Where the retail client stands each race's bodies, from `charcreategrp.dat`.
 *
 * Its twenty records are ten base classes by two sexes, grouped by race in
 * six clusters of world positions -- the same order this gallery enumerates,
 * class then sex. Each carries a yaw as well, and the yaws are the point: no
 * race stands in a line facing front. The outer bodies turn inward and the
 * inner ones face out, by as much as seventy degrees on the dark elves.
 *
 * Both are the client's, scaled the way bodies are, but neither can be taken
 * raw: the client gives every race its own camera in the lobby level, so a
 * world position and an absolute yaw only mean anything against that camera.
 * Each group is projected onto its own -- the camera looks from wherever the
 * bodies collectively look, and each position is resolved along that camera's
 * right and forward. Simply rotating the group to face front instead gets the
 * shape right and comes out mirrored, because Unreal's right-hand side is not
 * the one that lands on the right of the screen: for the humans it puts the
 * fighters on the wrong side of the frame.
 */
const CLIENT_SLOTS: Record<RaceNames, GallerySlot[]> = {
  HUMAN: [
    { x: -1.96, z: 0.11, yaw: 0.69 },
    { x: -0.8, z: -0.27, yaw: -0.02 },
    { x: 0.79, z: -0.2, yaw: 0.1 },
    { x: 1.96, z: 0.36, yaw: -0.81 },
  ],
  ELF: [
    { x: -1.66, z: 0.19, yaw: 0.89 },
    { x: -0.67, z: -0.32, yaw: 0.11 },
    { x: 0.69, z: -0.15, yaw: -0.19 },
    { x: 1.64, z: 0.27, yaw: -0.77 },
  ],
  DARK_ELF: [
    { x: -1.41, z: -0.04, yaw: 1.28 },
    { x: -0.74, z: -0.81, yaw: 0.61 },
    { x: 0.68, z: 0.08, yaw: -0.73 },
    { x: 1.48, z: 0.77, yaw: -1.04 },
  ],
  ORC: [
    { x: -1.83, z: -0.37, yaw: 1.21 },
    { x: -0.75, z: -0.98, yaw: 0.04 },
    { x: 0.85, z: -0.08, yaw: -0.06 },
    { x: 1.73, z: 1.43, yaw: -1.14 },
  ],
  DWARF: [
    { x: -0.71, z: 0.01, yaw: 0.39 },
    { x: 0.71, z: -0.01, yaw: -0.39 },
  ],
  KAMAEL: [
    { x: -0.7, z: 0.04, yaw: 0.39 },
    { x: 0.7, z: -0.04, yaw: -0.39 },
  ],
};

/** Even spacing in a line, for a race the client table has no row count for. */
const FALLBACK_SPACING = 1.3 * CLIENT_DATA_CORRECTION;

// CLIENT_SLOTS is transcribed straight from charcreategrp.dat's own numbers
// (see its own comment) at the OLD CHARACTER_MODEL_SCALE -- corrected here,
// on the way out, rather than in the table itself, so the table stays a
// literal record of what the client says instead of a mix of the client's
// numbers and this app's own scale history. yaw is an angle, not a
// distance, so it's the one field the correction leaves alone.
function slotsFor(race: RaceNames, count: number): GallerySlot[] {
  const slots = CLIENT_SLOTS[race];
  if (slots.length === count) {
    return slots.map((slot) => ({ ...slot, x: slot.x * CLIENT_DATA_CORRECTION, z: slot.z * CLIENT_DATA_CORRECTION }));
  }
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => ({ x: (index - mid) * FALLBACK_SPACING, z: 0, yaw: 0 }));
}

export const RACE_GALLERY: GalleryGroup[] = RACES.map((race) => {
  const variants: GalleryVariant[] = [];
  for (const baseClass of getAvailableBaseClasses(race)) {
    for (const sex of SEXES) {
      variants.push({ race, baseClass, sex });
    }
  }
  return { race, variants, slots: slotsFor(race, variants.length) };
});
