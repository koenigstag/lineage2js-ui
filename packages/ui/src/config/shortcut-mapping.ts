import { L2Item, L2Shortcut, ShortcutType } from "@lineage2js/network";
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
