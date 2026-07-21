// Matches @lineage2js/network's Race/Sex enum key names exactly (L2User.Race
// and .Sex come back from the server as those key strings, e.g. "HUMAN",
// "MALE" -- see network-mapping.ts) so no translation layer is needed
// between the two.
export type Race = "HUMAN" | "ELF" | "DARK_ELF" | "ORC" | "DWARF" | "KAMAEL";
export type BaseClass = "fighter" | "mystic";
export type Sex = "MALE" | "FEMALE";

export const RACES: Race[] = ["HUMAN", "ELF", "DARK_ELF", "ORC", "DWARF", "KAMAEL"];

export const RACE_LABELS: Record<Race, string> = {
  HUMAN: "Human",
  ELF: "Elf",
  DARK_ELF: "Dark Elf",
  ORC: "Orc",
  DWARF: "Dwarf",
  KAMAEL: "Kamael",
};

// Dwarves and Kamael have no Mystic subclasses.
const RACES_WITHOUT_MYSTIC = new Set<Race>(["DWARF", "KAMAEL"]);

export function getAvailableBaseClasses(race: Race): BaseClass[] {
  return RACES_WITHOUT_MYSTIC.has(race) ? ["fighter"] : ["fighter", "mystic"];
}

// Orc mystics are called Shaman -- same baseClass ("mystic") under the hood, different display name.
export function getBaseClassLabel(race: Race, baseClass: BaseClass): string {
  if (baseClass === "mystic" && race === "ORC") {
    return "Shaman";
  }
  return baseClass === "fighter" ? "Fighter" : "Mystic";
}

const RACE_SKIN_COLORS: Record<Race, string> = {
  HUMAN: "#d8b98a",
  ELF: "#e8cfa8",
  DARK_ELF: "#a8a49c",
  ORC: "#6a8a4a",
  DWARF: "#c9a074",
  KAMAEL: "#f0d0d0",
};

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

export interface BaseStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
}

// Flavor/demo base stats per race -- not exact game formulas, just enough
// differentiation to read as distinct archetypes (no server data yet).
const RACE_BASE_STATS: Record<Race, BaseStats> = {
  HUMAN: { str: 40, dex: 30, con: 43, int: 21, wit: 11, men: 25 },
  ELF: { str: 36, dex: 30, con: 38, int: 21, wit: 11, men: 34 },
  DARK_ELF: { str: 39, dex: 34, con: 36, int: 21, wit: 11, men: 29 },
  ORC: { str: 42, dex: 26, con: 44, int: 19, wit: 10, men: 29 },
  DWARF: { str: 40, dex: 30, con: 46, int: 21, wit: 9, men: 24 },
  KAMAEL: { str: 41, dex: 33, con: 40, int: 19, wit: 9, men: 28 },
};

export function getBaseStats(race: Race): BaseStats {
  return RACE_BASE_STATS[race];
}
