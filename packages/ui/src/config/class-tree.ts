import { ClassId, Race } from "@lineage2js/network";

export type ClassRole = "tank" | "healer" | "buffer" | "rogue" | "archer" | "summoner" | "mage" | "warrior";

export interface ClassTreeEntry {
  isMage: boolean;
  isSummoner: boolean;
  race: Race;
  parent: ClassId | null;
  /** Icon category for party window. */
  role: ClassRole;
}

// Ported from lineage2ts's own server-side class model
// (game-server/source/gameService/models/base/ClassId.ts), rekeyed onto this
// project's ClassId/Race enums instead of lineage2ts's string keys (both
// enums are identical id-for-id/value-for-value to lineage2ts's, confirmed
// against its ClassId.ts and Race.ts). isMage/parent/race come straight from
// the reference server, not inferred from a class-name heuristic.
export const CLASS_TREE: Partial<Record<ClassId, ClassTreeEntry>> = {
  [ClassId.Fighter]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: null, role: "warrior" },
  [ClassId.Warrior]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Fighter, role: "warrior" },
  [ClassId.Gladiator]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Warrior, role: "warrior" },
  [ClassId.Warlord]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Warrior, role: "warrior" },
  [ClassId.Knight]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Fighter, role: "tank" },
  [ClassId.Paladin]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Knight, role: "tank" },
  [ClassId.DarkAvenger]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Knight, role: "tank" },
  [ClassId.Rogue]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Fighter, role: "warrior" },
  [ClassId.TreasureHunter]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Rogue, role: "rogue" },
  [ClassId.Hawkeye]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Rogue, role: "archer" },

  [ClassId.Mage]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: null, role: "mage" },
  [ClassId.Wizard]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Mage, role: "mage" },
  [ClassId.Sorceror]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Wizard, role: "mage" },
  [ClassId.Necromancer]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Wizard, role: "mage" },
  [ClassId.Warlock]: { isMage: true, isSummoner: true, race: Race.HUMAN, parent: ClassId.Wizard, role: "summoner" },
  [ClassId.Cleric]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Mage, role: "healer" },
  [ClassId.Bishop]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Cleric, role: "healer" },
  [ClassId.Prophet]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Cleric, role: "buffer" },

  [ClassId.ElvenFighter]: { isMage: false, isSummoner: false, race: Race.ELF, parent: null, role: "warrior" },
  [ClassId.ElvenKnight]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenFighter, role: "tank" },
  [ClassId.TempleKnight]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenKnight, role: "tank" },
  [ClassId.SwordSinger]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenKnight, role: "buffer" },
  [ClassId.ElvenScout]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenFighter, role: "warrior" },
  [ClassId.PlainsWalker]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenScout, role: "rogue" },
  [ClassId.SilverRanger]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenScout, role: "archer" },

  [ClassId.ElvenMage]: { isMage: true, isSummoner: false, race: Race.ELF, parent: null, role: "mage" },
  [ClassId.ElvenWizard]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenMage, role: "mage" },
  [ClassId.Spellsinger]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenWizard, role: "mage" },
  [ClassId.ElementalSummoner]: { isMage: true, isSummoner: true, race: Race.ELF, parent: ClassId.ElvenWizard, role: "summoner" },
  [ClassId.Oracle]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenMage, role: "healer" },
  [ClassId.Elder]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.Oracle, role: "healer" },

  [ClassId.DarkFighter]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: null, role: "warrior" },
  [ClassId.PalusKnight]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkFighter, role: "tank" },
  [ClassId.ShillienKnight]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.PalusKnight, role: "tank" },
  [ClassId.Bladedancer]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.PalusKnight, role: "buffer" },
  [ClassId.Assassin]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkFighter, role: "warrior" },
  [ClassId.AbyssWalker]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Assassin, role: "rogue" },
  [ClassId.PhantomRanger]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Assassin, role: "archer" },

  [ClassId.DarkMage]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: null, role: "mage" },
  [ClassId.DarkWizard]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkMage, role: "mage" },
  [ClassId.Spellhowler]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkWizard, role: "mage" },
  [ClassId.PhantomSummoner]: { isMage: true, isSummoner: true, race: Race.DARK_ELF, parent: ClassId.DarkWizard, role: "summoner" },
  [ClassId.ShillienOracle]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkMage, role: "healer" },
  [ClassId.ShillenElder]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.ShillienOracle, role: "healer" },

  [ClassId.OrcFighter]: { isMage: false, isSummoner: false, race: Race.ORC, parent: null, role: "warrior" },
  [ClassId.OrcRaider]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcFighter, role: "warrior" },
  [ClassId.Destroyer]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcRaider, role: "warrior" },
  [ClassId.OrcMonk]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcFighter, role: "warrior" },
  [ClassId.Tyrant]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcMonk, role: "warrior" },

  [ClassId.OrcMage]: { isMage: true, isSummoner: false, race: Race.ORC, parent: null, role: "mage" },
  [ClassId.OrcShaman]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.OrcMage, role: "buffer" },
  [ClassId.Overlord]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.OrcShaman, role: "buffer" },
  [ClassId.Warcryer]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.OrcShaman, role: "buffer" },

  [ClassId.DwarvenFighter]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: null, role: "warrior" },
  [ClassId.Scavenger]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.DwarvenFighter, role: "warrior" },
  [ClassId.BountyHunter]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.Scavenger, role: "warrior" },
  [ClassId.Artisan]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.DwarvenFighter, role: "warrior" },
  [ClassId.Warsmith]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.Artisan, role: "warrior" },

  [ClassId.Duelist]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Gladiator, role: "warrior" },
  [ClassId.Dreadnought]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Warlord, role: "warrior" },
  [ClassId.PhoenixKnight]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Paladin, role: "tank" },
  [ClassId.HellKnight]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.DarkAvenger, role: "tank" },
  [ClassId.Sagittarius]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Hawkeye, role: "archer" },
  [ClassId.Adventurer]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.TreasureHunter, role: "rogue" },
  [ClassId.Archmage]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Sorceror, role: "mage" },
  [ClassId.Soultaker]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Necromancer, role: "mage" },
  [ClassId.ArcanaLord]: { isMage: true, isSummoner: true, race: Race.HUMAN, parent: ClassId.Warlock, role: "summoner" },
  [ClassId.Cardinal]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Bishop, role: "healer" },
  [ClassId.Hierophant]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Prophet, role: "buffer" },

  [ClassId.EvaTemplar]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.TempleKnight, role: "tank" },
  [ClassId.SwordMuse]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.SwordSinger, role: "buffer" },
  [ClassId.WindRider]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.PlainsWalker, role: "rogue" },
  [ClassId.MoonlightSentinel]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.SilverRanger, role: "archer" },
  [ClassId.MysticMuse]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.Spellsinger, role: "mage" },
  [ClassId.ElementalMaster]: { isMage: true, isSummoner: true, race: Race.ELF, parent: ClassId.ElementalSummoner, role: "summoner" },
  [ClassId.EvaSaint]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.Elder, role: "healer" },

  [ClassId.ShillienTemplar]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.ShillienKnight, role: "tank" },
  [ClassId.SpectralDancer]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Bladedancer, role: "buffer" },
  [ClassId.GhostHunter]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.AbyssWalker, role: "rogue" },
  [ClassId.GhostSentinel]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.PhantomRanger, role: "archer" },
  [ClassId.StormScreamer]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Spellhowler, role: "mage" },
  [ClassId.SpectralMaster]: { isMage: true, isSummoner: true, race: Race.DARK_ELF, parent: ClassId.PhantomSummoner, role: "summoner" },
  [ClassId.ShillienSaint]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.ShillenElder, role: "healer" },

  [ClassId.Titan]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.Destroyer, role: "warrior" },
  [ClassId.GrandKhavatari]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.Tyrant, role: "warrior" },
  [ClassId.Dominator]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.Overlord, role: "buffer" },
  [ClassId.Doomcryer]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.Warcryer, role: "buffer" },

  [ClassId.FortuneSeeker]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.BountyHunter, role: "warrior" },
  [ClassId.Maestro]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.Warsmith, role: "warrior" },

  [ClassId.MaleSoldier]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: null, role: "warrior" },
  [ClassId.FemaleSoldier]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: null, role: "warrior" },
  [ClassId.Trooper]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.MaleSoldier, role: "warrior" },
  [ClassId.Warder]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.FemaleSoldier, role: "warrior" },
  [ClassId.Berserker]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Trooper, role: "warrior" },
  [ClassId.MaleSoulbreaker]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Trooper, role: "warrior" },
  [ClassId.FemaleSoulbreaker]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Warder, role: "warrior" },
  [ClassId.Arbalester]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Warder, role: "archer" },
  [ClassId.Doombringer]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Berserker, role: "warrior" },
  [ClassId.MaleSoulhound]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.MaleSoulbreaker, role: "warrior" },
  [ClassId.FemaleSoulhound]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.FemaleSoulbreaker, role: "warrior" },
  [ClassId.Trickster]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Arbalester, role: "archer" },
  [ClassId.Inspector]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Warder, role: "warrior" },
  [ClassId.Judicator]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Inspector, role: "warrior" },
};

// L2Character.ClassId/L2User.ClassId comes back inconsistently depending on
// which packet set it: CharSelected assigns the raw numeric wire value, while
// UserInfo reverse-maps it through the ClassId enum first and assigns the
// resulting string key name instead (see UserInfo.ts's
// `(ClassId as any)[this.readD()]`) -- the same quirk toLocalRace/toLocalSex
// handle for Race/Sex in character-races.ts. Normalizes either shape back to
// the PascalCase key name ("FortuneSeeker").
function classIdKeyName(classId: ClassId): string | undefined {
  return typeof classId === "string" ? classId : ClassId[classId];
}

// Human-readable class name straight from the enum's own PascalCase key
// (FortuneSeeker -> "Fortune Seeker") -- there's no class-name table anywhere
// in the network layer (L2Creature.ClassName/BaseClassName are declared but
// no packet parser ever assigns them), and every real ClassId key already
// matches the official class name once spaced out. Not localized: class
// names are proper nouns, same treatment as skill/item names elsewhere (no
// static per-language dictionary entries for them).
export function getClassLabel(classId: ClassId | undefined): string {
  const key = classId !== undefined ? classIdKeyName(classId) : undefined;
  return key ? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2") : "";
}

// "warrior" only as a last resort for ClassIds absent from CLASS_TREE
// entirely (the DummyEntry3x placeholders -- no real character ever has one).
export function getClassRole(classId: ClassId): ClassRole {
  return CLASS_TREE[classId]?.role ?? "warrior";
}
