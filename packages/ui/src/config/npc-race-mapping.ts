import { Race as NetworkRace } from "@lineage2js/network";
import { rootStore } from "../stores/RootStore";

// Every race value the network's Race enum can represent, except NONE (a
// "no race" sentinel, not a displayable one) -- derived from the enum's own
// key names via keyof typeof rather than hand-duplicated, so it can't
// silently drift if Race.ts ever gains/loses/renames a member. Confirmed
// identical to L2J_Mobius's HighFive datapack race vocabulary (dist/game/
// data/stats/npcs/*.xml's <race>), see DatapackStore.loadNpcRaces() -- and a
// strict superset of character-races.ts's RaceNames (the 6 playable races).
export type NpcRace = Exclude<keyof typeof NetworkRace, "NONE">;

// Reactive read, not baked onto the entity: DatapackStore.npcRaces loads
// asynchronously (see DatapackStore.loadNpcRaces()), same treatment as
// item-mapping.ts's getItemName(). Not every npc template id has a race in
// the datapack (Folk/quest-givers mostly don't) -- those return undefined.
export function getNpcRace(npcId: number): NpcRace | undefined {
  return rootStore.datapack.npcRaces[npcId] as NpcRace | undefined;
}

/**
 * Flavor placeholder tint per NpcRace -- no per-monster art exists yet
 * (same "no character art" situation as PlayerModel's placeholder capsule),
 * this just gives CreatureModel something more distinct than one flat color
 * per kind. Not exhaustive by design: any NpcRace missing here (and any npc
 * with no resolvable race at all, e.g. Folk/quest-givers) falls back to
 * CreatureModel's per-kind default color.
 *
 * @deprecated Invented colors, not ported from any datapack/reference
 * source (unlike NpcRace itself). Once real per-monster models/art land,
 * this table (and CreatureModel's placeholder-color path) becomes obsolete
 * -- delete rather than trying to "correct" the colors.
 */
const NPC_RACE_COLORS: Partial<Record<NpcRace, string>> = {
  ANIMAL: "#8a6a4a",
  BEAST: "#6a4a3a",
  BUG: "#5a7a3a",
  CASTLE_GUARD: "#7a7a8a",
  CONSTRUCT: "#8a8a6a",
  DARK_ELF: "#5a3a5a",
  DEMONIC: "#7a2a2a",
  DIVINE: "#d0c080",
  DRAGON: "#2a6a5a",
  DWARF: "#a06a3a",
  ELEMENTAL: "#3a7a8a",
  ELF: "#5a8a5a",
  FAIRY: "#c07ab0",
  GIANT: "#6a5a4a",
  HUMAN: "#6a5a4a",
  HUMANOID: "#7a6a5a",
  KAMAEL: "#8a3a4a",
  MERCENARY: "#8a6a3a",
  ORC: "#4a6a3a",
  PLANT: "#3a8a3a",
  SIEGE_WEAPON: "#6a6a6a",
  UNDEAD: "#4a4a5a",
};

/** @deprecated See NPC_RACE_COLORS -- placeholder tint, not real reference data. */
export function getNpcRaceColor(race: NpcRace | undefined): string | undefined {
  return race ? NPC_RACE_COLORS[race] : undefined;
}
