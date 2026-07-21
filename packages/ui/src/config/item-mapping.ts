import { L2Item, ItemType2, ItemGrade } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";

/** Derives the icon-slot/tab category straight from the wire's Type2 + BodyPart, no separate UI type needed. */
export function getItemSlotType(item: L2Item): IconSlotType {
  switch (item.Type2) {
    case ItemType2.Weapon:
      return "item-weapon";
    case ItemType2.ShieldArmor:
      return item.BodyPart === L2Item.SLOT_L_HAND ? "item-shield" : "item-armor";
    case ItemType2.RingEarringNecklace:
      return "item-jewelry";
    default:
      return "item-misc";
  }
}

export const EQUIPMENT_SLOT_TYPES = new Set<IconSlotType>([
  "item-weapon",
  "item-shield",
  "item-armor",
  "item-jewelry",
]);

// The wire protocol has no notion of "this misc item is a usable potion" vs
// "this is a raw crafting material" -- both are just Type2.Item. Real clients
// resolve that (plus names/icons) from a static item-template table this
// project doesn't have yet. Until then, the inventory's Consume/Craft tabs
// fall back to this small id-keyed placeholder, covering only the store's
// own demo inventory (see GameStore.createDemoInventory).
const DEMO_MISC_CATEGORY_BY_ITEM_ID: Partial<Record<number, "consume" | "ingredient">> = {
  1060: "consume",
  1061: "consume",
  1867: "ingredient",
  1025: "ingredient",
};

export function getMiscItemCategory(item: L2Item): "consume" | "ingredient" | undefined {
  return DEMO_MISC_CATEGORY_BY_ITEM_ID[item.Id];
}

const GRADE_LABELS: Partial<Record<ItemGrade, string>> = {
  [ItemGrade.D]: "D",
  [ItemGrade.C]: "C",
  [ItemGrade.B]: "B",
  [ItemGrade.A]: "A",
  [ItemGrade.S]: "S",
  [ItemGrade.S80]: "S80",
  [ItemGrade.S84]: "S84",
};

/** No label for ItemGrade.None/unset -- nothing to show in the tooltip. */
export function getItemGradeLabel(item: L2Item): string | undefined {
  return GRADE_LABELS[item.Grade];
}
