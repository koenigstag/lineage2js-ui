import type { BaseClass, PlayerVariant, RaceNames, SexNames } from "./character-races";
import type { NpcRace } from "./npc-race-mapping";

const CHARACTER_MODEL_BASE_URL = import.meta.env.VITE_CHARACTER_MODEL_BASE_URL;

/**
 * Rig file names, matching the retail client's own body-mesh naming
 * (`MFighter`, `FDarkElf`, ...) since that's what the converted files are
 * named after. All sixteen are converted from the client itself
 * (assets-server/scripts/convert-client-rigs.ts). Ten of them used to come
 * from a Unity port instead; converting those from the client too was worth
 * doing for the textures, and it confirmed the port had been faithful -- the
 * human fighter came out to the same height and the same head position, to
 * three decimals.
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
 * and Kamael use one body per sex whatever the class.
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
 * file name -> a token the assets server derives from that file's size and
 * mtime, fetched once per session. Hanging it off a model's URL is what lets
 * the bodies be cached properly: a re-converted one arrives under a URL the
 * browser has never seen, instead of the old one being served from cache for
 * as long as its max-age says.
 *
 * Resolves to null when the server is older than the endpoint, or isn't
 * there at all -- in which case URLs stay bare and caching behaves as it did
 * before.
 */
let versionsRequest: Promise<Record<string, string> | null> | undefined;

function modelVersions(): Promise<Record<string, string> | null> {
  versionsRequest ??= (async () => {
    if (!CHARACTER_MODEL_BASE_URL) return null;
    const base = CHARACTER_MODEL_BASE_URL.endsWith("/") ? CHARACTER_MODEL_BASE_URL : `${CHARACTER_MODEL_BASE_URL}/`;
    try {
      const response = await fetch(`${base}versions.json`);
      if (!response.ok) return null;
      return (await response.json()) as Record<string, string>;
    } catch {
      return null;
    }
  })();
  return versionsRequest;
}

/** The same model URL with its version attached, once that's known. */
export async function versionedModelUrl(url: string): Promise<string> {
  const versions = await modelVersions();
  const version = versions?.[url.split("/").pop() ?? ""];
  return version ? `${url}?v=${version}` : url;
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
