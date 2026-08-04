import { L2Item } from "@lineage2js/network";

export type PaperdollSlotKey =
  | "hair1"
  | "head"
  | "hair2"
  | "under"
  | "chest"
  | "belt"
  | "gloves"
  | "legs"
  | "feet"
  | "rarm"
  | "larm"
  | "cloak"
  | "rear"
  | "lear"
  | "neklace"
  | "rring"
  | "lring"
  | "rbracelet"
  | "decor1"
  | "decor2"
  | "decor3"
  | "decor4"
  | "decor5"
  | "decor6"
  | "lbracelet";

/** Visual grid for the inventory window's equip panel, 3 columns x 9 rows (null = empty filler cell). */
export const PAPERDOLL_LAYOUT: (PaperdollSlotKey | null)[][] = [
  ["hair1", "head", "hair2"],
  ["under", "chest", "belt"],
  ["gloves", "legs", "feet"],
  ["rarm", "larm", "cloak"],
  ["rear", "neklace", "lear"],
  ["rring", "rbracelet", "lring"],
  ["decor1", "decor2", "decor3"],
  ["decor4", "decor5", "decor6"],
  ["lbracelet", null, null],
];

/** L2Item.BodyPart (a single wire slot-bitmask value, not runtime-OR'd) to the paperdoll cell(s) it fills -- dual-slot templates (full armor, two-handed weapon, dual earring/ring/hair) light up both cells with the same item. */
const SLOT_KEYS_BY_BODY_PART: Partial<Record<number, PaperdollSlotKey[]>> = {
  [L2Item.SLOT_HAIRALL]: ["hair1", "hair2"],
  [L2Item.SLOT_HAIR]: ["hair1"],
  [L2Item.SLOT_HAIR2]: ["hair2"],
  [L2Item.SLOT_HEAD]: ["head"],
  [L2Item.SLOT_UNDERWEAR]: ["under"],
  [L2Item.SLOT_FULL_ARMOR]: ["chest", "legs"],
  [L2Item.SLOT_CHEST]: ["chest"],
  [L2Item.SLOT_BELT]: ["belt"],
  [L2Item.SLOT_GLOVES]: ["gloves"],
  [L2Item.SLOT_LEGS]: ["legs"],
  [L2Item.SLOT_FEET]: ["feet"],
  [L2Item.SLOT_LR_HAND]: ["rarm", "larm"],
  [L2Item.SLOT_R_HAND]: ["rarm"],
  [L2Item.SLOT_L_HAND]: ["larm"],
  [L2Item.SLOT_BACK]: ["cloak"],
  [L2Item.SLOT_LR_EAR]: ["rear", "lear"],
  [L2Item.SLOT_R_EAR]: ["rear"],
  [L2Item.SLOT_L_EAR]: ["lear"],
  [L2Item.SLOT_NECK]: ["neklace"],
  [L2Item.SLOT_LR_FINGER]: ["rring", "lring"],
  [L2Item.SLOT_R_FINGER]: ["rring"],
  [L2Item.SLOT_L_FINGER]: ["lring"],
  [L2Item.SLOT_R_BRACELET]: ["rbracelet"],
  [L2Item.SLOT_L_BRACELET]: ["lbracelet"],
};

const DECOR_SLOT_KEYS: PaperdollSlotKey[] = ["decor1", "decor2", "decor3", "decor4", "decor5", "decor6"];

/**
 * Talismans all share BodyPart === SLOT_DECO -- the wire protocol doesn't carry
 * which of the 6 decor cells a given one occupies, so equipped ones are assigned
 * decor1..decor6 in inventory order until a real slot-index field is available.
 */
export function getEquippedItemsBySlot<T extends { IsEquipped: boolean; BodyPart: number }>(
  items: T[]
): Partial<Record<PaperdollSlotKey, T>> {
  const result: Partial<Record<PaperdollSlotKey, T>> = {};
  let decorIndex = 0;

  for (const item of items) {
    if (!item.IsEquipped) {
      continue;
    }
    if (item.BodyPart === L2Item.SLOT_DECO) {
      const key = DECOR_SLOT_KEYS[decorIndex++];
      if (key) {
        result[key] = item;
      }
      continue;
    }
    SLOT_KEYS_BY_BODY_PART[item.BodyPart]?.forEach((key) => {
      result[key] = item;
    });
  }

  return result;
}
