import { t } from "../lang/lang";

// Matches @lineage2js/network's Race/Sex enum key names exactly (L2User.Race
// and .Sex come back from the server as those key strings, e.g. "HUMAN",
// "MALE" -- see network-mapping.ts) so no translation layer is needed
// between the two.
export type Race = "HUMAN" | "ELF" | "DARK_ELF" | "ORC" | "DWARF" | "KAMAEL";
export type BaseClass = "fighter" | "mystic";
export type Sex = "MALE" | "FEMALE";

export const RACES: Race[] = ["HUMAN", "ELF", "DARK_ELF", "ORC", "DWARF", "KAMAEL"];

export function getRaceLabel(race: Race): string {
  return t(`classes.race.${race}`);
}

// Dwarves and Kamael have no Mystic subclasses.
const RACES_WITHOUT_MYSTIC = new Set<Race>(["DWARF", "KAMAEL"]);

export function getAvailableBaseClasses(race: Race): BaseClass[] {
  return RACES_WITHOUT_MYSTIC.has(race) ? ["fighter"] : ["fighter", "mystic"];
}

export function getBaseClassLabel(baseClass: BaseClass): string {
  return t(`classes.baseClass.${baseClass}`);
}

/**
 * @deprecated Invented placeholder tones, not ported from any real art/
 * reference source -- stand-ins for CharacterModel's capsule-and-sphere
 * placeholder until real character models/skins exist, at which point this
 * table becomes obsolete (delete rather than "correct" the colors).
 */
const RACE_SKIN_COLORS: Record<Race, string> = {
  HUMAN: "#d8b98a",
  ELF: "#e8cfa8",
  DARK_ELF: "#a8a49c",
  ORC: "#6a8a4a",
  DWARF: "#c9a074",
  KAMAEL: "#f0d0d0",
};

/** @deprecated See RACE_SKIN_COLORS -- placeholder tone, not real reference data. */
export function getSkinColor(race: Race): string {
  return RACE_SKIN_COLORS[race];
}

export interface BodyScale {
  height: number;
  width: number;
}

const DEFAULT_BODY_SCALE: BodyScale = { height: 1, width: 1 };

// Race-wide defaults (apply regardless of class unless overridden below).
const RACE_BODY_SCALE: Partial<Record<Race, BodyScale>> = {
  ELF: { height: 1, width: 0.82 },
  DARK_ELF: { height: 1, width: 0.82 },
};

// Class/sex-specific overrides, checked before the race-wide default.
const CLASS_BODY_SCALE_OVERRIDES: Partial<Record<Race, Partial<Record<BaseClass, Record<Sex, BodyScale>>>>> = {
  HUMAN: {
    fighter: { MALE: { height: 1, width: 1.3 }, FEMALE: { height: 1, width: 1.05 } },
    mystic: { MALE: { height: 1, width: 1 }, FEMALE: { height: 1, width: 1 } },
  },
  ORC: {
    fighter: { MALE: { height: 1.15, width: 1.75 }, FEMALE: { height: 1.15, width: 1.2 } },
    mystic: { MALE: { height: 1.15, width: 1 }, FEMALE: { height: 1.15, width: 1 } },
  },
  DWARF: {
    fighter: { MALE: { height: 0.72, width: 1.5 }, FEMALE: { height: 0.72, width: 1.2 } },
  },
};

export function getBodyScale(race: Race, baseClass: BaseClass, sex: Sex): BodyScale {
  return CLASS_BODY_SCALE_OVERRIDES[race]?.[baseClass]?.[sex] ?? RACE_BODY_SCALE[race] ?? DEFAULT_BODY_SCALE;
}

export interface PlayerVariant {
  race: Race;
  baseClass: BaseClass;
  sex: Sex;
}

/**
 * Only baseClass+sex actually distinguish the placeholder body color today
 * (race affects skin tone/body scale separately, see getSkinColor/getBodyScale
 * above) -- race is still part of the variant shape since callers always
 * have a full PlayerVariant on hand (from either the character list or a
 * nearby CharInfo), and skin/scale below do need it.
 *
 * @deprecated Invented placeholder tones, not ported from any real art/
 * reference source -- same "temp until real models exist" status as
 * RACE_SKIN_COLORS.
 */
const CLASS_COLORS: Record<BaseClass, { MALE: string; FEMALE: string }> = {
  fighter: { MALE: "#8a4a3a", FEMALE: "#b06a4a" },
  mystic: { MALE: "#3a5a8a", FEMALE: "#6a8ab0" },
};

/** @deprecated See CLASS_COLORS -- placeholder tone, not real reference data. */
export function colorForVariant(variant: PlayerVariant): string {
  return CLASS_COLORS[variant.baseClass][variant.sex];
}

export interface PlayerVisual {
  color: string;
  skinColor: string;
  heightScale: number;
  widthScale: number;
  hasCape: boolean;
}

/** Everything CharacterModel needs to render a player variant -- the single place this combination is computed, reused by PlayerModel (char-select/char-create/CreatureModel's player branch). */
export function getPlayerVisualFromVariant(variant: PlayerVariant): PlayerVisual {
  const bodyScale = getBodyScale(variant.race, variant.baseClass, variant.sex);
  return {
    color: colorForVariant(variant),
    skinColor: getSkinColor(variant.race),
    heightScale: bodyScale.height,
    widthScale: bodyScale.width,
    hasCape: variant.race === "KAMAEL",
  };
}

export interface BaseStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
}

/**
 * Flavor/demo base stats per race -- not exact game formulas, just enough
 * differentiation to read as distinct archetypes (no server data yet).
 *
 * @deprecated Invented placeholder values, not ported from any real
 * server/datapack formula -- replace with the real per-race starting stats
 * once that data is sourced, don't try to "correct" these numbers in place.
 */
const RACE_BASE_STATS: Record<Race, BaseStats> = {
  HUMAN: { str: 40, dex: 30, con: 43, int: 21, wit: 11, men: 25 },
  ELF: { str: 36, dex: 30, con: 38, int: 21, wit: 11, men: 34 },
  DARK_ELF: { str: 39, dex: 34, con: 36, int: 21, wit: 11, men: 29 },
  ORC: { str: 42, dex: 26, con: 44, int: 19, wit: 10, men: 29 },
  DWARF: { str: 40, dex: 30, con: 46, int: 21, wit: 9, men: 24 },
  KAMAEL: { str: 41, dex: 33, con: 40, int: 19, wit: 9, men: 28 },
};

/** @deprecated See RACE_BASE_STATS -- placeholder values, not real reference data. */
export function getBaseStats(race: Race): BaseStats {
  return RACE_BASE_STATS[race];
}
