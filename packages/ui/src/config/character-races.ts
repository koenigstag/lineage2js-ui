import { Race as NetworkRace, Sex as NetworkSex } from "@lineage2js/network";
import { t } from "../lang/lang";
import { rootStore } from "../stores/RootStore";

// The 6 playable races/2 selectable sexes -- which subset of the network's
// full Race/Sex enums a player can actually be is domain knowledge that has
// to be hand-curated here, but `satisfies` checks every literal against the
// enums' own key names, so a typo or a renamed/removed enum member fails
// the build instead of silently drifting out of sync (see toLocalRace()/
// toLocalSex() in network-mapping.ts for the reverse direction).
export const RACES = ["HUMAN", "ELF", "DARK_ELF", "ORC", "DWARF", "KAMAEL"] as const satisfies readonly (keyof typeof NetworkRace)[];
export type RaceNames = (typeof RACES)[number];

export const SEXES = ["MALE", "FEMALE"] as const satisfies readonly (keyof typeof NetworkSex)[];
export type SexNames = (typeof SEXES)[number];

export type BaseClass = "fighter" | "mystic";

export function getRaceLabel(race: RaceNames): string {
  return t(`classes.race.${race}`);
}

// Dwarves and Kamael have no Mystic subclasses.
const RACES_WITHOUT_MYSTIC = new Set<RaceNames>(["DWARF", "KAMAEL"]);

export function getAvailableBaseClasses(race: RaceNames): BaseClass[] {
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
const RACE_SKIN_COLORS: Record<RaceNames, string> = {
  HUMAN: "#d8b98a",
  ELF: "#e8cfa8",
  DARK_ELF: "#a8a49c",
  ORC: "#6a8a4a",
  DWARF: "#c9a074",
  KAMAEL: "#f0d0d0",
};

/** @deprecated See RACE_SKIN_COLORS -- placeholder tone, not real reference data. */
export function getSkinColor(race: RaceNames): string {
  return RACE_SKIN_COLORS[race];
}

export interface BodyScale {
  height: number;
  width: number;
}

const DEFAULT_BODY_SCALE: BodyScale = { height: 1, width: 1 };

// RaceNames-wide defaults (apply regardless of class unless overridden below).
const RACE_BODY_SCALE: Partial<Record<RaceNames, BodyScale>> = {
  ELF: { height: 1, width: 0.82 },
  DARK_ELF: { height: 1, width: 0.82 },
};

// Class/sex-specific overrides, checked before the race-wide default.
const CLASS_BODY_SCALE_OVERRIDES: Partial<Record<RaceNames, Partial<Record<BaseClass, Record<SexNames, BodyScale>>>>> = {
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

export function getBodyScale(race: RaceNames, baseClass: BaseClass, sex: SexNames): BodyScale {
  return CLASS_BODY_SCALE_OVERRIDES[race]?.[baseClass]?.[sex] ?? RACE_BODY_SCALE[race] ?? DEFAULT_BODY_SCALE;
}

export interface PlayerVariant {
  race: RaceNames;
  baseClass: BaseClass;
  sex: SexNames;
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

// Brief pre-load fallback only -- DatapackStore.characterBaseStats starts
// empty until loadCharacterBaseStats() resolves (see App.tsx), same "loads
// asynchronously" gap as classNames/getClassLabel()'s "" fallback. In
// practice this never shows: char-create is reached well after the app-mount
// fetch has settled.
const FALLBACK_BASE_STATS: BaseStats = { str: 25, dex: 25, con: 25, int: 25, wit: 25, men: 25 };

/**
 * Real starting STR/DEX/CON/INT/WIT/MEN, sourced from L2J_Mobius's HighFive
 * datapack (see DatapackStore.characterBaseStats for provenance) -- reactive
 * read, not baked onto any entity, same treatment as getNpcRace(). Only used
 * as network-mapping.ts's getTemplateStats() fallback before the real
 * server-provided CharacterTemplate list has loaded; once it has, the
 * server's own numbers win (and should match this table, since both trace
 * back to the same datapack).
 */
export function getBaseStats(race: RaceNames, baseClass: BaseClass, sex: SexNames): BaseStats {
  return rootStore.datapack.characterBaseStats[race]?.[baseClass]?.[sex] ?? FALLBACK_BASE_STATS;
}
