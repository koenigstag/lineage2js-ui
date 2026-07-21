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
