import { L2Item, ItemType2, ItemGrade, ShotsType, Element } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";
import type { SlotContent } from "../components/windows/core/slot.component";
import type { TooltipDetail } from "../components/core/tooltip.component";
import { getItemIconUrl } from "./icon-urls";
import { t } from "../lang/lang";
import { rootStore } from "../stores/RootStore";

// Reactive read, not a stored field: UiStore.itemNames loads asynchronously
// (see DatapackStore.loadItemNames()), so this must be called at render time inside
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

/** True for soulshot/spiritshot item templates (RequestAutoSoulShot's `ShotsType` reverse-lookup guard, same check the wire packet itself enforces). */
export function isShotItem(item: { Id: number }): boolean {
  return ShotsType[item.Id] !== undefined;
}

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

// Retail shows no grade tag at all for ItemGrade.None (confirmed against
// lineage2ts's/L2J_Mobius's source -- no UI-facing "NG" string exists
// anywhere server-side, it's purely an internal code identifier). This
// project deliberately shows "NG" instead, but only for the item kinds a
// grade is actually meaningful for -- equipment (weapon/shield/armor/
// jewelry) and shots -- not the thousands of ungraded quest items/
// materials/consumables that would otherwise get a noisy "NG" too.
const NG_LABEL = "NG";

/**
 * item.Grade itself is never populated from real wire data (no item packet
 * sends grade/crystal_type, see DatapackStore.itemGrades' comment and
 * TODO.md) -- it's only ever explicitly set by demo data (GameStore.
 * createDemoInventory), which this still honors first so existing demo
 * grades keep working; real items fall through to the datapack lookup.
 */
export function getItemGradeLabel(item: L2Item): string | undefined {
  const grade = item.Grade || rootStore.datapack.itemGrades[item.Id];
  if (grade) {
    return GRADE_LABELS[grade];
  }
  return EQUIPMENT_SLOT_TYPES.has(getItemSlotType(item)) || isShotItem(item) ? NG_LABEL : undefined;
}

const ELEMENT_KEYS: Partial<Record<Element, string>> = {
  [Element.Fire]: "fire",
  [Element.Water]: "water",
  [Element.Wind]: "wind",
  [Element.Earth]: "earth",
  [Element.Holy]: "holy",
  [Element.Unholy]: "unholy",
};

/**
 * The stat lines an item's tooltip shows, in the order a real client lists
 * them: what it does in a fight first, then what it costs to carry.
 *
 * Split by where the number comes from, because the two halves have very
 * different reliability. The combat stats are datapack (see
 * DatapackStore.itemStats) -- the wire never sends them, so they describe
 * the item *template* and know nothing about this particular instance.
 * Enchant level, attack attribute and augmentation are the opposite: they're
 * per-instance and come straight off the wire, and until now the UI parsed
 * and then discarded them.
 *
 * Reactive read of the datapack, like getItemName/getItemGradeLabel -- must
 * be called at render time inside an observer.
 */
export function getItemStatLines({ id, attackElement, isAugmented }: ItemSlotParams): string[] {
  const lines: string[] = [];
  const stats = rootStore.datapack.itemStats[id];

  if (stats) {
    const stat = (key: string, value: number | undefined) => {
      if (value !== undefined) {
        lines.push(t(`tooltip.${key}`, { value }));
      }
    };
    stat("pAtkLabel", stats.pAtk);
    stat("mAtkLabel", stats.mAtk);
    stat("pDefLabel", stats.pDef);
    stat("mDefLabel", stats.mDef);
    stat("shieldDefLabel", stats.shieldDef);
    stat("shieldRateLabel", stats.shieldRate);
    stat("evasionLabel", stats.evasion);
    stat("atkSpdLabel", stats.atkSpd);
    stat("critLabel", stats.crit);
    // Only for something that actually reaches: every melee weapon in the
    // datapack is 40, which says nothing.
    if (stats.range !== undefined && stats.range > MELEE_ATTACK_RANGE) {
      stat("rangeLabel", stats.range);
    }
    stat("accuracyLabel", stats.accuracy);
    stat("mpConsumeLabel", stats.mpConsume);
    if (stats.soulshots !== undefined || stats.spiritshots !== undefined) {
      lines.push(t("tooltip.shotsLabel", { soulshots: stats.soulshots ?? 0, spiritshots: stats.spiritshots ?? 0 }));
    }
    stat("weightLabel", stats.weight);
  }

  // Per-instance, straight off the wire (see GameClientPacket.readItem).
  if (attackElement && attackElement.value > 0) {
    const element = ELEMENT_KEYS[attackElement.type as Element];
    if (element) {
      lines.push(t("tooltip.attributeLabel", { element: t(`tooltip.elements.${element}`), value: attackElement.value }));
    }
  }
  if (isAugmented) {
    lines.push(t("tooltip.augmentedLabel"));
  }

  return lines;
}

/** Datapack attack range for anything swung by hand -- above it the weapon genuinely has reach and the number is worth a line. */
const MELEE_ATTACK_RANGE = 40;

export interface ItemSlotParams {
  id: number;
  /** Icon-slot category -- callers with a full L2Item pass getItemSlotType(item); placeholder items (e.g. a skill's required-item) that don't carry Type2/BodyPart pass "item-misc" directly. */
  slotType: IconSlotType;
  count?: number;
  grade?: string;
  isEquipped?: boolean;
  /** Per-instance, from the wire -- rendered as retail does, as a "+N" in front of the name. */
  enchantLevel?: number;
  /** Per-instance attack attribute, from the wire. `type` is an Element; a zero value means none. */
  attackElement?: { type: number; value: number };
  /** Per-instance, from the wire (AugmentBonus is non-zero). */
  isAugmented?: boolean;
  /** "full" is reserved for the inventory window (the item's own domain). Defaults to "short" -- see TooltipDetail. */
  detail?: TooltipDetail;
}

/** Builds the Slot component's content for an item icon -- the one place assembling the "item" tooltip shape (see inventory.window.tsx and skill.window.tsx's required-item slot). */
export function getItemSlotContent(params: ItemSlotParams): SlotContent {
  const { id, slotType, count, grade, isEquipped, enchantLevel, detail = "short" } = params;
  const name = getItemName({ Id: id });

  return {
    type: slotType,
    data: { id, count },
    count,
    iconUrl: getItemIconUrl(id),
    tooltip: {
      kind: "item",
      // Retail puts the enchant in front of the name rather than on a line
      // of its own, and it reads the same way here: "+7 Sword of Delusion".
      name: enchantLevel ? `+${enchantLevel} ${name}` : name,
      type: slotType,
      id,
      count,
      grade,
      isEquipped,
      stats: getItemStatLines(params),
      detail,
    },
  };
}
