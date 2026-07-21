import type { L2Skill } from "@lineage2js/network";
import { t } from "../lang/lang";

// Reactive read, not a stored field: UiStore.skillNames loads asynchronously
// (see UiStore.loadSkillNames()), so this must be called at render time
// inside an observer -- same reasoning as item-mapping.ts's getItemName().
export function getSkillName(skill: L2Skill): string {
  return t(`skill.name.${skill.Id}`);
}
