import {
  ClassId,
  L2Character,
  Race as NetworkRace,
  Sex as NetworkSex,
  type CharacterTemplate,
  type L2User,
} from "@lineage2js/network";
import {
  RACES,
  getAvailableBaseClasses,
  getBaseStats,
  type BaseClass,
  type BaseStats,
  type Race,
  type Sex,
} from "./character-races";
import classTreeData from "../assets/class_tree.json";

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

interface ClassTreeNode {
  classId: number;
  name: string;
  subclasses: ClassTreeNode[];
}

// classId of every class down each race's "mystic" tree, across all
// advancement tiers -- derived by walking assets/class_tree.json (a
// community-maintained class tree) rather than hand-listing class names, so
// it stays correct if that file is ever updated. A tree root is a mystic
// root iff its name contains "mystic" (human_mystic/elven_mystic/
// dark_mystic/orc_mystic); every other root (including Dwarf/Kamael, which
// have no mystic tree, and the newer-chronicle branches like Ertheia/4th
// classes that this project's ClassId enum doesn't define) classifies as
// "fighter" by default, matching the old behavior.
function collectMysticClassIds(): Set<number> {
  const mysticIds = new Set<number>();

  function walk(node: ClassTreeNode, isMystic: boolean): void {
    if (isMystic) mysticIds.add(node.classId);
    node.subclasses.forEach((child) => walk(child, isMystic));
  }

  Object.values(classTreeData as Record<string, ClassTreeNode[]>).forEach((roots) => {
    roots.forEach((root) => walk(root, root.name.includes("mystic")));
  });

  return mysticIds;
}

const MYSTIC_CLASS_IDS = collectMysticClassIds();

function classifyBaseClass(classIdName: string): BaseClass {
  const classId = ClassId[classIdName as keyof typeof ClassId];
  return MYSTIC_CLASS_IDS.has(classId) ? "mystic" : "fighter";
}

export function toLocalBaseClass(user: L2User): BaseClass {
  return classifyBaseClass(user.ClassId as unknown as string);
}

// The tier-0 ClassId a freshly created character starts as. Kamael is the
// only race where it depends on sex instead of just race+baseClass.
export function getStartingClassId(race: Race, baseClass: BaseClass, sex: Sex): ClassId {
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
  race: Race,
  baseClass: BaseClass,
  sex: Sex
): CharacterTemplate | undefined {
  const startingClassId = ClassId[getStartingClassId(race, baseClass, sex)];
  return templates.find((template) => (template.ClassId as unknown as string) === startingClassId);
}

// Adaptive to whatever the server actually offers instead of assuming our own
// fixed 6-race/2-class table: if a server adds/removes a template, the picker
// follows along on its own instead of needing a code change here. Only falls
// back to the static table before requestCharacterTemplates() has run yet
// (e.g. templates is still empty).
export function getAvailableRacesFromTemplates(templates: CharacterTemplate[]): Race[] {
  if (templates.length === 0) {
    return RACES;
  }
  const present = new Set(templates.map((template) => template.Race as unknown as string));
  return RACES.filter((race) => present.has(race));
}

export function getAvailableBaseClassesFromTemplates(templates: CharacterTemplate[], race: Race): BaseClass[] {
  const classesForRace = templates.filter((template) => (template.Race as unknown as string) === race);
  if (classesForRace.length === 0) {
    return getAvailableBaseClasses(race);
  }
  const present = new Set(classesForRace.map((template) => classifyBaseClass(template.ClassId as unknown as string)));
  return (["fighter", "mystic"] as BaseClass[]).filter((baseClass) => present.has(baseClass));
}

// Prefers the real server-provided template (see requestCharacterTemplates())
// and only falls back to the flavor table if it isn't available yet.
export function getTemplateStats(templates: CharacterTemplate[], race: Race, baseClass: BaseClass, sex: Sex): BaseStats {
  const template = findCharacterTemplate(templates, race, baseClass, sex);
  if (!template) {
    return getBaseStats(race);
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
 * stat-point allocator in this UI yet, so STR/DEX/... reuse whatever the
 * char-create template preview showed -- the real server template if
 * requestCharacterTemplates() already ran, the flavor table otherwise.
 */
export function buildNewCharacter(input: NewCharacterInput, templates: CharacterTemplate[]): L2Character {
  const stats = getTemplateStats(templates, input.race, input.baseClass, input.sex);
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
