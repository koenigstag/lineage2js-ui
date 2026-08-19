import { rootStore } from "../stores/RootStore";

// Reactive read, not baked onto the entity: DatapackStore.npcLevels loads
// asynchronously (see DatapackStore.loadNpcLevels()), same treatment as
// npc-race-mapping.ts's getNpcRace(). Sourced from the same L2J_Mobius
// datapack (<npc id level=...>) -- the wire protocol never sends a
// monster's level, only its template id (see NpcInfo.ts).
export function getNpcLevel(npcId: number): number | undefined {
  return rootStore.datapack.npcLevels[npcId];
}
