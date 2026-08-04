import { rootStore } from "../stores/RootStore";

// Reactive read, not baked onto the entity: DatapackStore.npcNames loads
// asynchronously (see DatapackStore.loadNpcNames()), same treatment as
// item-mapping.ts's getItemName(). Sourced from adrenalinebot.com's HighFive
// database (public/npc-names/<lang>.json), since not every NpcInfo packet
// carries a real name on the wire -- see NpcInfo.ts's own comment: some
// templates deliberately send an empty name string and expect the client to
// resolve it locally (lineage2ts's isUsingServerSideName() flag), same as a
// real client would from its own NPC name table. Falls back to the
// "Mob #<id>"/"NPC #<id>" placeholder this project has always shown when
// the table doesn't have an entry either.
export function getNpcName(npcId: number, isAttackable: boolean): string {
  return rootStore.datapack.npcNames[npcId] || `${isAttackable ? "Mob" : "NPC"} #${npcId}`;
}
