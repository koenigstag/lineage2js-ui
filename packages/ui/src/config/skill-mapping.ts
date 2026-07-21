import { t } from "../lang/lang";

// Reactive read, not a stored field: UiStore.skillNames loads asynchronously
// (see UiStore.loadSkillNames()), so this must be called at render time
// inside an observer -- same reasoning as item-mapping.ts's getItemName().
// Structural `{ Id }` rather than L2Skill: a buff (L2Buff) is just an active
// skill instance on the character, keyed by the exact same skill id (see
// AbnormalStatusUpdate's readImpl()), so this covers both without a
// duplicate getBuffName().
export function getSkillName(skill: { Id: number }): string {
  return t(`skill.name.${skill.Id}`);
}
