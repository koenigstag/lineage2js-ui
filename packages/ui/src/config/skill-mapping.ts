import type { SlotContent } from "../components/windows/core/slot.component";
import type { TooltipDetail } from "../components/core/tooltip.component";
import { getSkillIconUrl } from "./icon-urls";
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

export interface SkillSlotParams {
  id: number;
  level: number;
  name?: string;
  cost?: number;
  /** Countdown target (Date.now() + remaining ms), see tooltip.component.tsx's expiresAt handling. */
  expiresAt?: number;
  /** "full" is reserved for the skills-list window (the skill's own domain). Defaults to "short" -- see TooltipDetail. */
  detail?: TooltipDetail;
}

/**
 * Builds the Slot component's content for a skill/buff/learnable-skill icon --
 * same "skill" tooltip shape (name/level/cost/expiresAt) whichever of
 * L2Skill, L2Buff or LearnableSkillSnapshot the caller has on hand, so this
 * is the one place that shape gets assembled instead of each window
 * duplicating it (see effects/skill/skills/target-select windows).
 */
export function getSkillSlotContent({ id, level, name, cost, expiresAt, detail = "short" }: SkillSlotParams): SlotContent {
  return {
    type: "skill",
    data: { id, level },
    iconUrl: getSkillIconUrl(id),
    tooltip: {
      kind: "skill",
      name: name ?? getSkillName({ Id: id }),
      stats: t("tooltip.levelLabel", { level }),
      cost,
      expiresAt,
      id,
      detail,
    },
  };
}
