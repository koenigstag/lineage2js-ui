import { L2Item } from "@lineage2js/network";

export type PaperdollSlotKey =
  | "hair1"
  | "head"
  | "hair2"
  | "gloves"
  | "chest"
  | "feet"
  | "cloak"
  | "legs"
  | "belt"
  | "rhand"
  | "lhand"
  | "rear"
  | "lear"
  | "neklace"
  | "rfinger"
  | "lfinger"
  | "under"
  | "decor1"
  | "decor2"
  | "decor3"
  | "decor4"
  | "decor5"
  | "decor6"
  | "rbracelet"
  | "lbracelet";

export interface PaperdollSection {
  rows: (PaperdollSlotKey | null)[][];
  /** Square cell size in px for every slot in this section. Defaults to the standard 34px slot -- decor cells render at half that. */
  slotSize?: number;
}

/** Visual layout for the inventory window's equip panel -- grouped into the same clusters (head / armor / weapons / jewelry / decor / bracelets) as the retail paperdoll, each its own compact grid stacked with a bigger gap between groups. */
export const PAPERDOLL_SECTIONS: PaperdollSection[] = [
  { rows: [["hair1", "head", "hair2"]] },
  {
    rows: [
      ["gloves", "chest", "feet"],
      ["cloak", "legs", "belt"],
    ],
  },
  { rows: [["rhand", null, "lhand"]] },
  {
    rows: [
      ["rear", "lear", "neklace"],
      ["rfinger", "lfinger", "under"],
    ],
  },
  { rows: [["decor1", "decor2", "decor3", "decor4", "decor5", "decor6"]], slotSize: 17 },
  { rows: [["rbracelet", "lbracelet"]] },
];

/**
 * L2Item.BodyPart (a single wire slot-bitmask value, not runtime-OR'd) to the
 * paperdoll cell(s) it fills. Cross-checked against real HighFive item data
 * (lineage2ts's items.csv slotBitType column) rather than assumed: earring and
 * ring templates never carry a single-side bitmask (SLOT_R_EAR/SLOT_L_EAR/
 * SLOT_R_FINGER/SLOT_L_FINGER don't occur in practice) -- every earring/ring
 * uses the shared SLOT_LR_EAR/SLOT_LR_FINGER value and is assigned to
 * whichever side is free at equip time, same ambiguity as the 6 decor slots.
 * That pairing is handled separately in getEquippedItemsBySlot, not here.
 * SLOT_ALLDRESS (full dress costumes) only lights up the chest cell, matching
 * retail behavior (confirmed via L2J_Mobius's BodyPart.getPaperdollIndex).
 */
const SLOT_KEYS_BY_BODY_PART: Partial<Record<number, PaperdollSlotKey[]>> = {
  [L2Item.SLOT_HAIRALL]: ["hair1", "hair2"],
  [L2Item.SLOT_HAIR]: ["hair1"],
  [L2Item.SLOT_HAIR2]: ["hair2"],
  [L2Item.SLOT_HEAD]: ["head"],
  [L2Item.SLOT_UNDERWEAR]: ["under"],
  [L2Item.SLOT_FULL_ARMOR]: ["chest", "legs"],
  [L2Item.SLOT_ALLDRESS]: ["chest"],
  [L2Item.SLOT_CHEST]: ["chest"],
  [L2Item.SLOT_BELT]: ["belt"],
  [L2Item.SLOT_GLOVES]: ["gloves"],
  [L2Item.SLOT_LEGS]: ["legs"],
  [L2Item.SLOT_FEET]: ["feet"],
  [L2Item.SLOT_LR_HAND]: ["rhand", "lhand"],
  [L2Item.SLOT_R_HAND]: ["rhand"],
  [L2Item.SLOT_L_HAND]: ["lhand"],
  [L2Item.SLOT_BACK]: ["cloak"],
  [L2Item.SLOT_NECK]: ["neklace"],
  [L2Item.SLOT_R_BRACELET]: ["rbracelet"],
  [L2Item.SLOT_L_BRACELET]: ["lbracelet"],
};

const DECOR_SLOT_KEYS: PaperdollSlotKey[] = ["decor1", "decor2", "decor3", "decor4", "decor5", "decor6"];
const EAR_SLOT_KEYS: PaperdollSlotKey[] = ["rear", "lear"];
const FINGER_SLOT_KEYS: PaperdollSlotKey[] = ["rfinger", "lfinger"];

/** Fills `keys[index]` (if any slot is still free) and returns the next index to try. */
function assignNextFree<T>(
  result: Partial<Record<PaperdollSlotKey, T>>,
  keys: PaperdollSlotKey[],
  index: number,
  item: T
): number {
  const key = keys[index];
  if (key) {
    result[key] = item;
  }
  return index + 1;
}

/**
 * Talismans (SLOT_DECO), earrings (SLOT_LR_EAR) and rings (SLOT_LR_FINGER) each
 * share one BodyPart value across every physical slot they can occupy -- the
 * wire protocol never says which specific cell a given equipped instance is
 * in, so equipped ones are assigned to the next free cell in inventory order
 * until a real per-instance slot-index field is available.
 */
export function getEquippedItemsBySlot<T extends { IsEquipped: boolean; BodyPart: number }>(
  items: T[]
): Partial<Record<PaperdollSlotKey, T>> {
  const result: Partial<Record<PaperdollSlotKey, T>> = {};
  let decorIndex = 0;
  let earIndex = 0;
  let fingerIndex = 0;

  for (const item of items) {
    if (!item.IsEquipped) {
      continue;
    }
    switch (item.BodyPart) {
      case L2Item.SLOT_DECO:
        decorIndex = assignNextFree(result, DECOR_SLOT_KEYS, decorIndex, item);
        break;
      case L2Item.SLOT_LR_EAR:
        earIndex = assignNextFree(result, EAR_SLOT_KEYS, earIndex, item);
        break;
      case L2Item.SLOT_LR_FINGER:
        fingerIndex = assignNextFree(result, FINGER_SLOT_KEYS, fingerIndex, item);
        break;
      default:
        SLOT_KEYS_BY_BODY_PART[item.BodyPart]?.forEach((key) => {
          result[key] = item;
        });
    }
  }

  return result;
}
