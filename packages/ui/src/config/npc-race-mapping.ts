import { rootStore } from "../stores/RootStore";

// Every race value actually present in L2J_Mobius's HighFive datapack
// (dist/game/data/stats/npcs/*.xml's <race>), see UiStore.loadNpcRaces().
export type NpcRace =
  | "ANIMAL"
  | "BEAST"
  | "BUG"
  | "CASTLE_GUARD"
  | "CONSTRUCT"
  | "DARK_ELF"
  | "DEMONIC"
  | "DIVINE"
  | "DRAGON"
  | "DWARF"
  | "ELEMENTAL"
  | "ELF"
  | "ETC"
  | "FAIRY"
  | "GIANT"
  | "HUMAN"
  | "HUMANOID"
  | "KAMAEL"
  | "MERCENARY"
  | "ORC"
  | "PLANT"
  | "SIEGE_WEAPON"
  | "UNDEAD";

// Reactive read, not baked onto the entity: UiStore.npcRaces loads
// asynchronously (see UiStore.loadNpcRaces()), same treatment as
// item-mapping.ts's getItemName(). Not every npc template id has a race in
// the datapack (Folk/quest-givers mostly don't) -- those return undefined.
export function getNpcRace(npcId: number): NpcRace | undefined {
  return rootStore.ui.npcRaces[npcId] as NpcRace | undefined;
}
