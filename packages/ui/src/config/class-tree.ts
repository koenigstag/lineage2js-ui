import { ClassId, Race } from "@lineage2js/network";

export interface ClassTreeEntry {
  isMage: boolean;
  isSummoner: boolean;
  race: Race;
  parent: ClassId | null;
}

// Ported from lineage2ts's own server-side class model
// (game-server/source/gameService/models/base/ClassId.ts), rekeyed onto this
// project's ClassId/Race enums instead of lineage2ts's string keys (both
// enums are identical id-for-id/value-for-value to lineage2ts's, confirmed
// against its ClassId.ts and Race.ts). isMage/parent/race come straight from
// the reference server, not inferred from a class-name heuristic.
export const CLASS_TREE: Partial<Record<ClassId, ClassTreeEntry>> = {
  [ClassId.Fighter]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: null },
  [ClassId.Warrior]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Fighter },
  [ClassId.Gladiator]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Warrior },
  [ClassId.Warlord]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Warrior },
  [ClassId.Knight]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Fighter },
  [ClassId.Paladin]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Knight },
  [ClassId.DarkAvenger]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Knight },
  [ClassId.Rogue]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Fighter },
  [ClassId.TreasureHunter]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Rogue },
  [ClassId.Hawkeye]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Rogue },

  [ClassId.Mage]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: null },
  [ClassId.Wizard]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Mage },
  [ClassId.Sorceror]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Wizard },
  [ClassId.Necromancer]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Wizard },
  [ClassId.Warlock]: { isMage: true, isSummoner: true, race: Race.HUMAN, parent: ClassId.Wizard },
  [ClassId.Cleric]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Mage },
  [ClassId.Bishop]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Cleric },
  [ClassId.Prophet]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Cleric },

  [ClassId.ElvenFighter]: { isMage: false, isSummoner: false, race: Race.ELF, parent: null },
  [ClassId.ElvenKnight]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenFighter },
  [ClassId.TempleKnight]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenKnight },
  [ClassId.SwordSinger]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenKnight },
  [ClassId.ElvenScout]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenFighter },
  [ClassId.PlainsWalker]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenScout },
  [ClassId.SilverRanger]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenScout },

  [ClassId.ElvenMage]: { isMage: true, isSummoner: false, race: Race.ELF, parent: null },
  [ClassId.ElvenWizard]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenMage },
  [ClassId.Spellsinger]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenWizard },
  [ClassId.ElementalSummoner]: { isMage: true, isSummoner: true, race: Race.ELF, parent: ClassId.ElvenWizard },
  [ClassId.Oracle]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.ElvenMage },
  [ClassId.Elder]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.Oracle },

  [ClassId.DarkFighter]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: null },
  [ClassId.PalusKnight]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkFighter },
  [ClassId.ShillienKnight]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.PalusKnight },
  [ClassId.Bladedancer]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.PalusKnight },
  [ClassId.Assassin]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkFighter },
  [ClassId.AbyssWalker]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Assassin },
  [ClassId.PhantomRanger]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Assassin },

  [ClassId.DarkMage]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: null },
  [ClassId.DarkWizard]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkMage },
  [ClassId.Spellhowler]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkWizard },
  [ClassId.PhantomSummoner]: { isMage: true, isSummoner: true, race: Race.DARK_ELF, parent: ClassId.DarkWizard },
  [ClassId.ShillienOracle]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.DarkMage },
  [ClassId.ShillenElder]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.ShillienOracle },

  [ClassId.OrcFighter]: { isMage: false, isSummoner: false, race: Race.ORC, parent: null },
  [ClassId.OrcRaider]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcFighter },
  [ClassId.Destroyer]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcRaider },
  [ClassId.OrcMonk]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcFighter },
  [ClassId.Tyrant]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.OrcMonk },

  [ClassId.OrcMage]: { isMage: true, isSummoner: false, race: Race.ORC, parent: null },
  [ClassId.OrcShaman]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.OrcMage },
  [ClassId.Overlord]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.OrcShaman },
  [ClassId.Warcryer]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.OrcShaman },

  [ClassId.DwarvenFighter]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: null },
  [ClassId.Scavenger]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.DwarvenFighter },
  [ClassId.BountyHunter]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.Scavenger },
  [ClassId.Artisan]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.DwarvenFighter },
  [ClassId.Warsmith]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.Artisan },

  [ClassId.Duelist]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Gladiator },
  [ClassId.Dreadnought]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Warlord },
  [ClassId.PhoenixKnight]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Paladin },
  [ClassId.HellKnight]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.DarkAvenger },
  [ClassId.Sagittarius]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.Hawkeye },
  [ClassId.Adventurer]: { isMage: false, isSummoner: false, race: Race.HUMAN, parent: ClassId.TreasureHunter },
  [ClassId.Archmage]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Sorceror },
  [ClassId.Soultaker]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Necromancer },
  [ClassId.ArcanaLord]: { isMage: true, isSummoner: true, race: Race.HUMAN, parent: ClassId.Warlock },
  [ClassId.Cardinal]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Bishop },
  [ClassId.Hierophant]: { isMage: true, isSummoner: false, race: Race.HUMAN, parent: ClassId.Prophet },

  [ClassId.EvaTemplar]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.TempleKnight },
  [ClassId.SwordMuse]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.SwordSinger },
  [ClassId.WindRider]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.PlainsWalker },
  [ClassId.MoonlightSentinel]: { isMage: false, isSummoner: false, race: Race.ELF, parent: ClassId.SilverRanger },
  [ClassId.MysticMuse]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.Spellsinger },
  [ClassId.ElementalMaster]: { isMage: true, isSummoner: true, race: Race.ELF, parent: ClassId.ElementalSummoner },
  [ClassId.EvaSaint]: { isMage: true, isSummoner: false, race: Race.ELF, parent: ClassId.Elder },

  [ClassId.ShillienTemplar]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.ShillienKnight },
  [ClassId.SpectralDancer]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Bladedancer },
  [ClassId.GhostHunter]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.AbyssWalker },
  [ClassId.GhostSentinel]: { isMage: false, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.PhantomRanger },
  [ClassId.StormScreamer]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.Spellhowler },
  [ClassId.SpectralMaster]: { isMage: true, isSummoner: true, race: Race.DARK_ELF, parent: ClassId.PhantomSummoner },
  [ClassId.ShillienSaint]: { isMage: true, isSummoner: false, race: Race.DARK_ELF, parent: ClassId.ShillenElder },

  [ClassId.Titan]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.Destroyer },
  [ClassId.GrandKhavatari]: { isMage: false, isSummoner: false, race: Race.ORC, parent: ClassId.Tyrant },
  [ClassId.Dominator]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.Overlord },
  [ClassId.Doomcryer]: { isMage: true, isSummoner: false, race: Race.ORC, parent: ClassId.Warcryer },

  [ClassId.FortuneSeeker]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.BountyHunter },
  [ClassId.Maestro]: { isMage: false, isSummoner: false, race: Race.DWARF, parent: ClassId.Warsmith },

  [ClassId.MaleSoldier]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: null },
  [ClassId.FemaleSoldier]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: null },
  [ClassId.Trooper]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.MaleSoldier },
  [ClassId.Warder]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.FemaleSoldier },
  [ClassId.Berserker]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Trooper },
  [ClassId.MaleSoulbreaker]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Trooper },
  [ClassId.FemaleSoulbreaker]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Warder },
  [ClassId.Arbalester]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Warder },
  [ClassId.Doombringer]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Berserker },
  [ClassId.MaleSoulhound]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.MaleSoulbreaker },
  [ClassId.FemaleSoulhound]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.FemaleSoulbreaker },
  [ClassId.Trickster]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Arbalester },
  [ClassId.Inspector]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Warder },
  [ClassId.Judicator]: { isMage: false, isSummoner: false, race: Race.KAMAEL, parent: ClassId.Inspector },
};
