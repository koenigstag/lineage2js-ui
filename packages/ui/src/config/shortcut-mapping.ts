import { L2Item, L2Shortcut, ShortcutType, type Actions } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";
import { getTypeText, type TooltipInfo } from "../components/core/tooltip.component";
import type { SlotContent } from "../components/windows/core/slot.component";
import { getItemIconUrl, getSkillIconUrl, getActionIconUrl } from "./icon-urls";
import { getItemSlotType, getItemName } from "./item-mapping";
import { getSkillName } from "./skill-mapping";
import { getActionName } from "./user-actions";
import { t } from "../lang/lang";

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

export function getShortcutSlotType(shortcut: L2Shortcut, inventoryItems: L2Item[]): IconSlotType {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return "skill";
    case ShortcutType.ITEM: {
      const item = resolveShortcutItem(shortcut, inventoryItems);
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

export function getShortcutIconUrl(shortcut: L2Shortcut, inventoryItems: L2Item[]): string | undefined {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return getSkillIconUrl(shortcut.TargetId);
    case ShortcutType.ITEM: {
      const item = resolveShortcutItem(shortcut, inventoryItems);
      return item ? getItemIconUrl(item.Id) : undefined;
    }
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
 * MACRO/RECIPE/BOOKMARK shortcuts have no per-id name table (unlike
 * items/skills/actions) -- there's nothing analogous to itemname/skillname/
 * action-names for those, so those fall back to the shortcut's category label.
 */
export function getShortcutName(shortcut: L2Shortcut, inventoryItems: L2Item[]): string {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return getSkillName({ Id: shortcut.TargetId });
    case ShortcutType.ITEM: {
      const item = resolveShortcutItem(shortcut, inventoryItems);
      return item ? getItemName(item) : getTypeText("item-misc");
    }
    case ShortcutType.ACTION:
      return getActionName({ code: shortcut.TargetId as Actions });
    default:
      return getTypeText(getShortcutSlotType(shortcut, inventoryItems));
  }
}

// Hotbar shortcuts are never the item/skill's own domain window -- always
// "short" (see TooltipDetail), regardless of type.
function getShortcutTooltip(shortcut: L2Shortcut, inventoryItems: L2Item[]): TooltipInfo {
  const name = getShortcutName(shortcut, inventoryItems);

  switch (shortcut.Type) {
    case ShortcutType.ITEM: {
      const item = resolveShortcutItem(shortcut, inventoryItems);
      return {
        kind: "item",
        name,
        type: getShortcutSlotType(shortcut, inventoryItems),
        id: item?.Id ?? shortcut.TargetId,
        detail: "short",
      };
    }
    case ShortcutType.SKILL:
      return {
        kind: "skill",
        name,
        stats: t("tooltip.levelLabel", { level: shortcut.Level }),
        id: shortcut.TargetId,
        detail: "short",
      };
    default:
      return { kind: "simple", name };
  }
}

/** Single place resolving a hotbar shortcut (TargetId, real id or ITEM's ObjectId) against the current inventory into the Slot component's content. */
export function getShortcutSlotContent(shortcut: L2Shortcut, inventoryItems: L2Item[]): SlotContent {
  return {
    type: getShortcutSlotType(shortcut, inventoryItems),
    data: shortcut,
    iconUrl: getShortcutIconUrl(shortcut, inventoryItems),
    tooltip: getShortcutTooltip(shortcut, inventoryItems),
  };
}
