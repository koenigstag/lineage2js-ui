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
  /** Gap between this section's own columns. Defaults to the standard column gap -- the accessories/hands sections use double that. */
  columnGap?: number;
  /** Centers this section's grid within the panel instead of the default left alignment. */
  center?: boolean;
}

export interface PaperdollBlock {
  /** One or more independently-sized grids stacked with the standard section gap. */
  sections: PaperdollSection[];
  /** Wraps the block's sections in a rounded, padded border instead of rendering them bare. */
  bordered?: boolean;
  /** Extra spacing added on top of the standard gap between this block and the one above it. */
  extraGapBefore?: number;
}

const BASE_COLUMN_GAP = 10;
const BODY_COLUMN_GAP = BASE_COLUMN_GAP * 2; // 20
const ACCESSORY_COLUMN_GAP = BASE_COLUMN_GAP * 4; // 40 (hands + accessories)
const DECOR_COLUMN_GAP = BASE_COLUMN_GAP; // 10, kept separate from BODY_COLUMN_GAP so it doesn't move if body's gap changes again

const DECOR_SLOT_SIZE = 25.5; // 1.5x the previous half-size (17px) decor cell

/** Visual layout for the inventory window's equip panel -- grouped into the same clusters (body+hands+accessories / decor+agathion / bracelet) as the retail paperdoll, each block its own independently-sized grid(s) stacked with a bigger gap between blocks. */
export const PAPERDOLL_BLOCKS: PaperdollBlock[] = [
  {
    // body + hands + accessories share one bordered block
    sections: [
      {
        // body (hair/head share the same grid as the armor rows)
        rows: [
          ["hair1", "head", "hair2"],
          ["gloves", "chest", "feet"],
          ["cloak", "legs", "belt"],
        ],
        columnGap: BODY_COLUMN_GAP,
        center: true,
      },
      { rows: [["rhand", "lhand"]], columnGap: ACCESSORY_COLUMN_GAP, center: true }, // hands
      {
        // accessories
        rows: [
          ["rear", "lear", "neklace"],
          ["rfinger", "lfinger", "under"],
        ],
        columnGap: ACCESSORY_COLUMN_GAP,
        center: true,
      },
    ],
    bordered: true,
  },
  {
    // decor + bracelets (lbracelet doubles as the agathion slot) share one bordered block
    sections: [
      { rows: [["decor1", "decor2", "decor3", "decor4", "decor5", "decor6"]], slotSize: DECOR_SLOT_SIZE, columnGap: DECOR_COLUMN_GAP },
      { rows: [["lbracelet", "rbracelet"]], columnGap: ACCESSORY_COLUMN_GAP, center: true },
    ],
    bordered: true,
    extraGapBefore: 5,
  },
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

// The 3 BodyPart values that fill two cells with the SAME physical item
// (hair1+hair2, rhand+lhand, chest+legs) -- mapped here to whichever of the
// two is the *secondary* cell. Checked against lineage2ts's own item data
// (cli/overrides/data/csv/items/itemIcons.csv): every item has exactly one
// icon id, no separate one for a second cell, so the secondary cell is
// purely a visual "this is occupied by the paired item" marker (dimmed,
// not independently clickable) rather than a distinct icon/item -- see
// isSecondaryCombinedSlot.
const SECONDARY_SLOT_BY_COMBINED_BODY_PART: Partial<Record<number, PaperdollSlotKey>> = {
  [L2Item.SLOT_HAIRALL]: "hair2",
  [L2Item.SLOT_LR_HAND]: "lhand",
  [L2Item.SLOT_FULL_ARMOR]: "legs",
};

/**
 * True when `item` occupies `slotKey` only as the secondary half of a
 * combined-slot pair (see SECONDARY_SLOT_BY_COMBINED_BODY_PART) -- the
 * primary cell (hair1/rhand/chest) is where equip/unequip actually happens;
 * the secondary cell just shows the same item is there too and can't be
 * unequipped on its own (it's the same physical item, not a separate one).
 */
export function isSecondaryCombinedSlot(slotKey: PaperdollSlotKey, item: { BodyPart: number }): boolean {
  return SECONDARY_SLOT_BY_COMBINED_BODY_PART[item.BodyPart] === slotKey;
}

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
// Single-side slot bits for unequipping specifically (RequestUnEquipItem's
// wire field, an L2ItemSlots value) -- an equipped earring/ring's own
// BodyPart is always the shared ambiguous SLOT_LR_EAR/SLOT_LR_FINGER value
// (see getEquippedItemsBySlot's comment), but lineage2ts's server tracks
// each physical one in its own specific InventorySlot.LeftEar/RightEar/...
// (confirmed against its models/itemcontainer/Inventory.ts's setPaperdollItem
// calls), so unequipping has to name the resolved side, matching whichever
// cell it's actually rendered in here, or the server can't tell which one.
const UNEQUIP_SLOT_OVERRIDES: Partial<Record<PaperdollSlotKey, number>> = {
  rear: L2Item.SLOT_R_EAR,
  lear: L2Item.SLOT_L_EAR,
  rfinger: L2Item.SLOT_R_FINGER,
  lfinger: L2Item.SLOT_L_FINGER,
};

/**
 * Resolves the RequestUnEquipItem slot value for an equipped paperdoll cell.
 * Returns undefined for the 6 decor/talisman cells specifically: they all
 * share one BodyPart (SLOT_DECO) with no per-cell wire value at all (unlike
 * ears/fingers, L2ItemSlots has no Decoration1..6), so RequestUnEquipItem
 * can't unambiguously target just one of several equipped talismans --
 * callers should fall back to useItem(item) instead, which targets an exact
 * objectId regardless of slot ambiguity.
 */
export function getUnequipSlot(slotKey: PaperdollSlotKey, item: { BodyPart: number }): number | undefined {
  if (slotKey.startsWith("decor")) {
    return undefined;
  }
  return UNEQUIP_SLOT_OVERRIDES[slotKey] ?? item.BodyPart;
}

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
