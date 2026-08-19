import { L2Item, L2Shortcut, L2Skill, ShortcutType } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";
import { getTypeText } from "../components/core/tooltip.component";
import type { SlotContent } from "../components/windows/core/slot.component";

/**
 * ITEM shortcuts carry the inventory item's ObjectId in TargetId, not its
 * template Id -- same instance-vs-template split as everywhere else L2Item
 * shows up on the wire (see GameClientPacket.readItem()). Resolves the real
 * L2Item so callers can read its template Id/Type2/BodyPart for icon/name/tab.
 */
export function resolveShortcutItem(shortcut: L2Shortcut, inventoryItems: L2Item[]): L2Item | undefined {
  return shortcut.Type === ShortcutType.ITEM
    ? inventoryItems.find((candidate) => candidate.ObjectId === shortcut.TargetId)
    : undefined;
}

/**
 * SKILL shortcuts only carry Id/Level on the wire (see readShortcut()) --
 * no MP cost. Resolves the matching L2Skill from the character's known
 * skill list so callers can read its Mp for the tooltip's "Cost" line.
 */
export function resolveShortcutSkill(shortcut: L2Shortcut, skills: L2Skill[]): L2Skill | undefined {
  return shortcut.Type === ShortcutType.SKILL
    ? skills.find((candidate) => candidate.Id === shortcut.TargetId)
    : undefined;
}

/**
 * SKILL/ITEM/ACTION shortcuts render via SkillSlot/ItemSlot/ActionSlot
 * instead (see ShortcutSlot) -- this covers what's left: MACRO/RECIPE/
 * BOOKMARK (no dedicated window/component yet) and an ITEM shortcut whose
 * target item isn't in the current inventory (e.g. consumed/dropped since
 * the shortcut was set). Neither has a per-id name table, so the category
 * label is the best available name.
 */
export function getShortcutFallbackContent(type: IconSlotType): SlotContent {
  return {
    type,
    tooltip: { kind: "simple", name: getTypeText(type) },
  };
}
