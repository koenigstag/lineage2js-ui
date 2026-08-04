import {
  ClassId,
  L2Character,
  L2Creature,
  Race as NetworkRace,
  Sex as NetworkSex,
  reverseEnumMap,
  type CharacterTemplate,
} from "@lineage2js/network";
import {
  RACES,
  getAvailableBaseClasses,
  getBaseClassLabel,
  getBaseStats,
  getRaceLabel,
  type BaseClass,
  type BaseStats,
  type RaceNames,
  type SexNames,
} from "./character-races";
import { CLASS_TREE } from "./class-tree";

// L2Creature.Race/Sex are stored as the raw numeric wire value (matching
// the Race/Sex enum's ordinals directly -- CharacterCreate.ts even writes
// Race back out with a plain writeD(), no encoding); the display string is
// purely a UI-facing concern, produced here via reverseEnumMap() (see its
// own doc comment for why not a direct NetworkRace[value] index) rather than
// character-races.ts's own separate constant. Built once and reused below
// instead of re-filtering the enum on every conversion.
const RACE_NAMES = reverseEnumMap(NetworkRace);
const SEX_NAMES = reverseEnumMap(NetworkSex);

// Typed against L2Creature (not L2User) since Race/Sex/ClassId are declared
// there -- shared by players (CharInfo/UserInfo) so the same conversion
// works whether the creature is the local player or one seen nearby. The
// cast narrows RACE_NAMES's full 24-value range (every Race enum member) down
// to RaceNames's 6 playable ones -- safe here because only player-populating
// packets (CharInfo/UserInfo/CharSelectionInfo) ever write L2Creature.Race,
// and they only ever encode one of those 6.
export function toLocalRace(creature: L2Creature): RaceNames {
  return RACE_NAMES.get(creature.Race) as RaceNames;
}

export function toLocalSex(creature: L2Creature): SexNames {
  return SEX_NAMES.get(creature.Sex) as SexNames;
}

// Fighter/mystic per classId, straight from CLASS_TREE's isMage (itself
// ported from lineage2ts's server-side class model) -- classes absent from
// CLASS_TREE (there are none in this project's ClassId enum, but the lookup
// is defensive) default to "fighter".
function classifyBaseClass(classIdName: string): BaseClass {
  const classId = ClassId[classIdName as keyof typeof ClassId];
  return CLASS_TREE[classId]?.isMage ? "mystic" : "fighter";
}

export function toLocalBaseClass(creature: L2Creature): BaseClass {
  return classifyBaseClass(creature.ClassId as unknown as string);
}

// Root-archetype display label for any class down its tree, independent of
// how far advanced the character actually is -- CLASS_TREE's race/isMage are
// the same for every node down a branch, so e.g. Necromancer displays the
// same as Mage: "Human Mystic". Used where a character's whole class lineage
// collapses to a single race+archetype label (not a screen for its exact
// current class).
export function getRootClassLabel(classIdName: string): string | undefined {
  const classId = ClassId[classIdName as keyof typeof ClassId];
  const entry = CLASS_TREE[classId];
  if (!entry) return undefined;

  const race = RACE_NAMES.get(entry.race) as RaceNames;
  const baseClass: BaseClass = entry.isMage ? "mystic" : "fighter";
  return `${getRaceLabel(race)} ${getBaseClassLabel(baseClass)}`;
}

// The tier-0 ClassId a freshly created character starts as. Kamael is the
// only race where it depends on sex instead of just race+baseClass.
export function getStartingClassId(race: RaceNames, baseClass: BaseClass, sex: SexNames): ClassId {
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

// CharacterTemplate.ClassId comes back as the enum *key name* (see
// RequestNewCharacterSuccess.ts), so look up the starting ClassId's own key
// name to match against it.
export function findCharacterTemplate(
  templates: CharacterTemplate[],
  race: RaceNames,
  baseClass: BaseClass,
  sex: SexNames
): CharacterTemplate | undefined {
  const startingClassId = ClassId[getStartingClassId(race, baseClass, sex)];
  return templates.find((template) => (template.ClassId as unknown as string) === startingClassId);
}

// Adaptive to whatever the server actually offers instead of assuming our own
// fixed 6-race/2-class table: if a server adds/removes a template, the picker
// follows along on its own instead of needing a code change here. Only falls
// back to the static table before requestCharacterTemplates() has run yet
// (e.g. templates is still empty).
export function getAvailableRacesFromTemplates(templates: CharacterTemplate[]): readonly RaceNames[] {
  if (templates.length === 0) {
    return RACES;
  }
  const present = new Set(templates.map((template) => RACE_NAMES.get(template.Race) as RaceNames));
  return RACES.filter((race) => present.has(race));
}

export function getAvailableBaseClassesFromTemplates(templates: CharacterTemplate[], race: RaceNames): BaseClass[] {
  const classesForRace = templates.filter((template) => RACE_NAMES.get(template.Race) === race);
  if (classesForRace.length === 0) {
    return getAvailableBaseClasses(race);
  }
  const present = new Set(classesForRace.map((template) => classifyBaseClass(template.ClassId as unknown as string)));
  return (["fighter", "mystic"] as BaseClass[]).filter((baseClass) => present.has(baseClass));
}

// Prefers the real server-provided template (see requestCharacterTemplates())
// and only falls back to the datapack-sourced table if it isn't available yet.
export function getTemplateStats(
  templates: CharacterTemplate[],
  race: RaceNames,
  baseClass: BaseClass,
  sex: SexNames
): BaseStats {
  const template = findCharacterTemplate(templates, race, baseClass, sex);
  if (!template) {
    return getBaseStats(race, baseClass, sex);
  }
  return {
    str: template.STR,
    dex: template.DEX,
    con: template.CON,
    int: template.INT,
    wit: template.WIT,
    men: template.MEN,
  };
}

export interface NewCharacterInput {
  nickname: string;
  race: RaceNames;
  baseClass: BaseClass;
  sex: SexNames;
  /** 0-based, matches the Face enum directly. */
  face: number;
  /** 0-based, matches the HairStyle enum directly. */
  hair: number;
  /** 0-based, matches the HairColor enum directly. */
  hairColor: number;
}

/**
 * Builds the L2Character payload for CommandCreateCharacter. There's no
 * stat-point allocator in this UI yet, so STR/DEX/... reuse whatever the
 * char-create template preview showed -- the real server template if
 * requestCharacterTemplates() already ran, the flavor table otherwise.
 */
export function buildNewCharacter(input: NewCharacterInput, templates: CharacterTemplate[]): L2Character {
  const stats = getTemplateStats(templates, input.race, input.baseClass, input.sex);
  const char = new L2Character();

  char.Name = input.nickname;
  // Forward direction (name -> number): a direct enum property access is
  // fine here, unlike the reverse direction above -- RACES/SEXES's
  // `satisfies` check guarantees input.race/input.sex are real keys of
  // NetworkRace/NetworkSex, so this can't return undefined.
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
