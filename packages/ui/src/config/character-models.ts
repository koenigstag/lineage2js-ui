import type { BaseClass, PlayerVariant, RaceNames, SexNames } from "./character-races";
import type { NpcRace } from "./npc-race-mapping";

const CHARACTER_MODEL_BASE_URL = import.meta.env.VITE_CHARACTER_MODEL_BASE_URL;

/**
 * Rig file names, matching the retail client's own body-mesh naming
 * (`MFighter`, `FDarkElf`, ...) since that's what the converted files are
 * named after. The first ten come from the Unity project
 * (assets-server/scripts/convert-unity-models.ts), the orc and Kamael six
 * from the client itself (convert-client-rigs.ts) -- indistinguishable once
 * converted.
 */
type RigName =
  | "MFighter"
  | "FFighter"
  | "MMagic"
  | "FMagic"
  | "MElf"
  | "FElf"
  | "MDarkElf"
  | "FDarkElf"
  | "MDwarf"
  | "FDwarf"
  | "MOrc"
  | "FOrc"
  | "MShaman"
  | "FShaman"
  | "MKamael"
  | "FKamael";

/**
 * Retail bodies are one mesh per race+sex, with humans the sole exception:
 * fighters and mystics are genuinely different bodies there (MFighter vs
 * MMagic), while an elf mystic wears the same body as an elf fighter.
 *
 * Orcs split the same way humans do -- the shaman body is the mystic one --
 * and Kamael use one body per sex whatever the class. Both races come from
 * the client directly (assets-server's convert-client-rigs.ts): the Unity
 * project the other ten are converted from has no models for either.
 */
const RIG_BY_RACE: Partial<Record<RaceNames, Partial<Record<BaseClass, Record<SexNames, RigName>>>>> = {
  HUMAN: {
    fighter: { MALE: "MFighter", FEMALE: "FFighter" },
    mystic: { MALE: "MMagic", FEMALE: "FMagic" },
  },
  ELF: {
    fighter: { MALE: "MElf", FEMALE: "FElf" },
    mystic: { MALE: "MElf", FEMALE: "FElf" },
  },
  DARK_ELF: {
    fighter: { MALE: "MDarkElf", FEMALE: "FDarkElf" },
    mystic: { MALE: "MDarkElf", FEMALE: "FDarkElf" },
  },
  DWARF: {
    fighter: { MALE: "MDwarf", FEMALE: "FDwarf" },
  },
  ORC: {
    fighter: { MALE: "MOrc", FEMALE: "FOrc" },
    mystic: { MALE: "MShaman", FEMALE: "FShaman" },
  },
  KAMAEL: {
    fighter: { MALE: "MKamael", FEMALE: "FKamael" },
    mystic: { MALE: "MKamael", FEMALE: "FKamael" },
  },
};

function modelUrl(rig: RigName | undefined): string | undefined {
  if (!rig || !CHARACTER_MODEL_BASE_URL) return undefined;
  const file = `${rig.toLowerCase()}.glb`;
  return CHARACTER_MODEL_BASE_URL.endsWith("/")
    ? CHARACTER_MODEL_BASE_URL + file
    : `${CHARACTER_MODEL_BASE_URL}/${file}`;
}

/** Converted body for a player variant, or undefined when that race has none (orc/Kamael) or no model server is configured. */
export function getCharacterModelUrl(variant: PlayerVariant): string | undefined {
  return modelUrl(RIG_BY_RACE[variant.race]?.[variant.baseClass]?.[variant.sex]);
}

/**
 * Converted body for a non-player humanoid. NpcInfo carries no sex and no
 * class, only a race resolved from the npc template id -- so an NPC of a
 * playable race borrows that race's male fighter body, and everything else
 * (beasts, undead, constructs, and the many NPCs with no race in the
 * datapack at all) gets undefined and stays on the placeholder body.
 */
export function getNpcModelUrl(race: NpcRace | undefined): string | undefined {
  if (!race) return undefined;
  return modelUrl(RIG_BY_RACE[race as RaceNames]?.fighter?.MALE);
}
