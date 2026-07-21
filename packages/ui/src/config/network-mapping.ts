import { ClassId, L2Character, Race as NetworkRace, Sex as NetworkSex, type L2User } from "@lineage2js/network";
import { getBaseStats, type BaseClass, type Race, type Sex } from "./character-races";

// L2User.Race/Sex come back from the server as the *enum key name* (e.g.
// "HUMAN", "MALE"), not the numeric value -- the vendored packet parser
// (CharSelectionInfo.ts) reverse-maps the wire byte through the enum object
// before assigning it. Race/Sex's local type literals are spelled to match
// those key names exactly (see character-races.ts), so reading one back is
// just a type-level cast, no translation table needed.
export function toLocalRace(user: L2User): Race {
  return user.Race as unknown as Race;
}

export function toLocalSex(user: L2User): Sex {
  return user.Sex as unknown as Sex;
}

// Every class that starts down the race's "mystic" tree, across all
// advancement tiers (High Five chronicle). Everything else -- including all
// Dwarf/Kamael classes, which never appear here -- defaults to "fighter".
// Typed against ClassId's own keys so a typo would be a compile error.
const MYSTIC_CLASS_NAMES = new Set<keyof typeof ClassId>([
  "Mage",
  "Wizard",
  "Sorceror",
  "Necromancer",
  "Warlock",
  "Cleric",
  "Bishop",
  "Prophet",
  "ElvenMage",
  "ElvenWizard",
  "Spellsinger",
  "ElementalSummoner",
  "Oracle",
  "Elder",
  "DarkMage",
  "DarkWizard",
  "Spellhowler",
  "PhantomSummoner",
  "ShillienOracle",
  "ShillenElder",
  "OrcMage",
  "OrcShaman",
  "Overlord",
  "Warcryer",
  "Archmage",
  "Soultaker",
  "ArcanaLord",
  "Cardinal",
  "Hierophant",
  "MysticMuse",
  "ElementalMaster",
  "EvaSaint",
  "StormScreamer",
  "SpectralMaster",
  "ShillienSaint",
  "Dominator",
  "Doomcryer",
]);

export function toLocalBaseClass(user: L2User): BaseClass {
  return MYSTIC_CLASS_NAMES.has(user.ClassId as unknown as keyof typeof ClassId) ? "mystic" : "fighter";
}

// The tier-0 ClassId a freshly created character starts as. Kamael is the
// only race where it depends on sex instead of just race+baseClass.
function getStartingClassId(race: Race, baseClass: BaseClass, sex: Sex): ClassId {
  switch (race) {
    case "HUMAN":
      return baseClass === "mystic" ? ClassId.Mage : ClassId.Fighter;
    case "ELF":
      return baseClass === "mystic" ? ClassId.ElvenMage : ClassId.ElvenFighter;
    case "DARK_ELF":
      return baseClass === "mystic" ? ClassId.DarkMage : ClassId.DarkFighter;
    case "ORC":
      return baseClass === "mystic" ? ClassId.OrcMage : ClassId.OrcFighter;
    case "DWARF":
      return ClassId.DwarvenFighter;
    case "KAMAEL":
      return sex === "FEMALE" ? ClassId.FemaleSoldier : ClassId.MaleSoldier;
  }
}

export interface NewCharacterInput {
  nickname: string;
  race: Race;
  baseClass: BaseClass;
  sex: Sex;
  /** 0-based, matches the Face enum directly. */
  face: number;
  /** 0-based, matches the HairStyle enum directly. */
  hair: number;
  /** 0-based, matches the HairColor enum directly. */
  hairColor: number;
}

/**
 * Builds the L2Character payload for CommandCreateCharacter. There's no
 * stat-point allocator in this UI yet, so STR/DEX/... reuse the same
 * flavor base-stats table the char-create template preview shows -- a
 * "quick create" would send the same numbers a real client does by default.
 */
export function buildNewCharacter(input: NewCharacterInput): L2Character {
  const stats = getBaseStats(input.race);
  const char = new L2Character();

  char.Name = input.nickname;
  char.Race = NetworkRace[input.race];
  char.Sex = NetworkSex[input.sex];
  char.ClassId = getStartingClassId(input.race, input.baseClass, input.sex);
  char.STR = stats.str;
  char.DEX = stats.dex;
  char.CON = stats.con;
  char.INT = stats.int;
  char.WIT = stats.wit;
  char.MEN = stats.men;
  char.HairStyle = input.hair;
  char.HairColor = input.hairColor;
  char.Face = input.face;

  return char;
}
