import { L2Item, ItemType2, ItemGrade } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";
import type { SlotContent } from "../components/windows/core/slot.component";
import { getItemIconUrl } from "./icon-urls";
import { t } from "../lang/lang";

// Reactive read, not a stored field: UiStore.itemNames loads asynchronously
// (see UiStore.loadItemNames()), so this must be called at render time inside
// an observer -- baking it into L2Item.Name at construction time would freeze
// the fallback key forever for any item parsed before the table finishes loading.
// Structural `{ Id }` rather than L2Item: a hotbar ITEM shortcut only carries
// a TargetId, not a full L2Item (see config/shortcut-mapping.ts).
export function getItemName(item: { Id: number }): string {
  return t(`item.name.${item.Id}`);
}

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
  727: "consume", // Healing Potion
  728: "consume", // Mana Potion
  1869: "ingredient", // Iron Ore
  702: "ingredient", // Wolf Pelt
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

export interface ItemSlotParams {
  id: number;
  /** Icon-slot category -- callers with a full L2Item pass getItemSlotType(item); placeholder items (e.g. a skill's required-item) that don't carry Type2/BodyPart pass "item-misc" directly. */
  slotType: IconSlotType;
  count?: number;
  grade?: string;
  isEquipped?: boolean;
}

/** Builds the Slot component's content for an item icon -- the one place assembling the "item" tooltip shape (see inventory.window.tsx and skill.window.tsx's required-item slot). */
export function getItemSlotContent({ id, slotType, count, grade, isEquipped }: ItemSlotParams): SlotContent {
  return {
    type: slotType,
    data: { id, count },
    count,
    iconUrl: getItemIconUrl(id),
    tooltip: {
      kind: "item",
      name: getItemName({ Id: id }),
      type: slotType,
      id,
      count,
      grade,
      isEquipped,
    },
  };
}
