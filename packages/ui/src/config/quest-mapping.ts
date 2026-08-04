import { rootStore } from "../stores/RootStore";

// Reactive read, not baked onto any entity: DatapackStore.questNames loads
// asynchronously (see DatapackStore.loadQuestNames()), same treatment as
// item-mapping.ts's getItemName(). No quest window exists yet and this
// vendored client doesn't even parse a quest-list packet (only
// ExQuestItemList, quest-flagged inventory items) -- this table is
// forward-looking infrastructure, sourced from adrenalinebot.com's HighFive
// database (public/quest-names/<lang>.json), for whenever that's built.
export function getQuestName(questId: number): string {
  return rootStore.datapack.questNames[questId] || `Quest #${questId}`;
}
