export type Race = "human" | "elf" | "dark-elf" | "orc" | "dwarf" | "kamael";
export type BaseClass = "fighter" | "mystic";
export type Sex = "male" | "female";

export const RACES: Race[] = ["human", "elf", "dark-elf", "orc", "dwarf", "kamael"];

export const RACE_LABELS: Record<Race, string> = {
  human: "Human",
  elf: "Elf",
  "dark-elf": "Dark Elf",
  orc: "Orc",
  dwarf: "Dwarf",
  kamael: "Kamael",
};

// Dwarves and Kamael have no Mystic subclasses.
const RACES_WITHOUT_MYSTIC = new Set<Race>(["dwarf", "kamael"]);

export function getAvailableBaseClasses(race: Race): BaseClass[] {
  return RACES_WITHOUT_MYSTIC.has(race) ? ["fighter"] : ["fighter", "mystic"];
}

// Orc mystics are called Shaman -- same baseClass ("mystic") under the hood, different display name.
export function getBaseClassLabel(race: Race, baseClass: BaseClass): string {
  if (baseClass === "mystic" && race === "orc") {
    return "Shaman";
  }
  return baseClass === "fighter" ? "Fighter" : "Mystic";
}

const RACE_SKIN_COLORS: Record<Race, string> = {
  human: "#d8b98a",
  elf: "#e8cfa8",
  "dark-elf": "#a8a49c",
  orc: "#6a8a4a",
  dwarf: "#c9a074",
  kamael: "#f0d0d0",
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
  elf: { height: 1, width: 0.82 },
  "dark-elf": { height: 1, width: 0.82 },
};

// Class/sex-specific overrides, checked before the race-wide default.
const CLASS_BODY_SCALE_OVERRIDES: Partial<Record<Race, Partial<Record<BaseClass, Record<Sex, BodyScale>>>>> = {
  human: {
    fighter: { male: { height: 1, width: 1.3 }, female: { height: 1, width: 1.05 } },
    mystic: { male: { height: 1, width: 1 }, female: { height: 1, width: 1 } },
  },
  orc: {
    fighter: { male: { height: 1.15, width: 1.75 }, female: { height: 1.15, width: 1.2 } },
    mystic: { male: { height: 1.15, width: 1 }, female: { height: 1.15, width: 1 } },
  },
  dwarf: {
    fighter: { male: { height: 0.72, width: 1.5 }, female: { height: 0.72, width: 1.2 } },
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
  human: { str: 40, dex: 30, con: 43, int: 21, wit: 11, men: 25 },
  elf: { str: 36, dex: 30, con: 38, int: 21, wit: 11, men: 34 },
  "dark-elf": { str: 39, dex: 34, con: 36, int: 21, wit: 11, men: 29 },
  orc: { str: 42, dex: 26, con: 44, int: 19, wit: 10, men: 29 },
  dwarf: { str: 40, dex: 30, con: 46, int: 21, wit: 9, men: 24 },
  kamael: { str: 41, dex: 33, con: 40, int: 19, wit: 9, men: 28 },
};

export function getBaseStats(race: Race): BaseStats {
  return RACE_BASE_STATS[race];
}

export interface Vitals {
  hp: number;
  mp: number;
  cp: number;
}

// Flavor/demo vitals derived from base stats -- not exact game formulas.
export function getBaseVitals(race: Race, baseClass: BaseClass): Vitals {
  const stats = getBaseStats(race);
  const isFighter = baseClass === "fighter";
  const hp = Math.round(stats.con * (isFighter ? 6.2 : 4.8));
  const mp = Math.round((stats.int + stats.wit + stats.men) * (isFighter ? 1.1 : 2.4));
  const cp = Math.round(hp * (isFighter ? 0.55 : 0.15));
  return { hp, mp, cp };
}
