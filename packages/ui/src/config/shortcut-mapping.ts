import { L2Item, L2Shortcut, ShortcutType } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";
import { getTypeText } from "../components/core/tooltip.component";
import { getItemIconUrl, getSkillIconUrl, getActionIconUrl } from "./icon-urls";
import { getItemSlotType, getItemName } from "./item-mapping";
import { getSkillName } from "./skill-mapping";

/**
 * Icon-slot category for a hotbar shortcut. ITEM shortcuts only carry a
 * TargetId (item template id), not the full L2Item (equip category needs
 * Type2/BodyPart) -- crossed-referenced against the current inventory list
 * when available, falling back to the generic "item-misc" gradient
 * otherwise (e.g. the item isn't in the demo inventory).
 */
export function getShortcutSlotType(shortcut: L2Shortcut, inventoryItems: L2Item[]): IconSlotType {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return "skill";
    case ShortcutType.ITEM: {
      const item = inventoryItems.find((candidate) => candidate.Id === shortcut.TargetId);
      return item ? getItemSlotType(item) : "item-misc";
    }
    case ShortcutType.MACRO:
      return "macro";
    case ShortcutType.ACTION:
    case ShortcutType.RECIPE:
    case ShortcutType.BOOKMARK:
    default:
      return "action";
  }
}

export function getShortcutIconUrl(shortcut: L2Shortcut): string | undefined {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return getSkillIconUrl(shortcut.TargetId);
    case ShortcutType.ITEM:
      return getItemIconUrl(shortcut.TargetId);
    case ShortcutType.ACTION:
    case ShortcutType.MACRO:
    case ShortcutType.RECIPE:
    case ShortcutType.BOOKMARK:
      return getActionIconUrl(shortcut.TargetId);
    default:
      return undefined;
  }
}

/**
 * ACTION/MACRO/RECIPE/BOOKMARK shortcuts have no per-id name table (unlike
 * items/skills) -- there's nothing analogous to itemname/skillname CSVs for
 * generic action ids, so those fall back to the shortcut's category label.
 */
export function getShortcutName(shortcut: L2Shortcut, inventoryItems: L2Item[]): string {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return getSkillName({ Id: shortcut.TargetId });
    case ShortcutType.ITEM:
      return getItemName({ Id: shortcut.TargetId });
    default:
      return getTypeText(getShortcutSlotType(shortcut, inventoryItems));
  }
}
