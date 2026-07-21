import { makeAutoObservable } from "mobx";
import type { IconSlotType } from "../components/core/icon-frame.component";

export interface Creature {
  id: string;
}

export type EquipmentItemType = "item-weapon" | "item-shield" | "item-armor" | "item-jewelry";

export interface InventoryItem {
  id: string;
  name: string;
  type: EquipmentItemType | "item-misc";
  /** item-misc only: usable by clicking (potions, scrolls, ...). */
  consume?: boolean;
  /** item-misc only: craft/recipe material. */
  ingredient?: boolean;
  /** Any item type: quest-bound, cannot be traded/dropped. */
  quest?: boolean;
  /** Stack size, mainly item-misc. Equipment stays unset (single instance). */
  count?: number;
}

export const MAX_CHARACTERS = 7;

const HOTBAR_SLOT_COUNT = 48; // 4 rows x 12 columns

// Demo content for the hotbar's first row: one example of every slot type.
const HOTBAR_ROW_1_DEMO: IconSlotType[] = [
  "skill",
  "action",
  "pair-action",
  "pet-action",
  "macro",
  "item-misc",
  "item-weapon",
  "item-armor",
  "item-jewelry",
];

function createDemoHotbar(): (IconSlotType | undefined)[] {
  const slots: (IconSlotType | undefined)[] = new Array(HOTBAR_SLOT_COUNT).fill(undefined);
  HOTBAR_ROW_1_DEMO.forEach((type, index) => {
    slots[index] = type;
  });
  return slots;
}

let nextItemId = 1;
function item(data: Omit<InventoryItem, "id">): InventoryItem {
  return { id: String(nextItemId++), ...data };
}

function createDemoInventory(): InventoryItem[] {
  return [
    item({ name: "Healing Potion", type: "item-misc", consume: true, count: 25 }),
    item({ name: "Mana Potion", type: "item-misc", consume: true, count: 10 }),
    item({ name: "Iron Ore", type: "item-misc", ingredient: true, count: 47 }),
    item({ name: "Wolf Pelt", type: "item-misc", ingredient: true, count: 132 }),
    item({ name: "Ancient Map Fragment", type: "item-misc", quest: true, count: 1 }),
    item({ name: "Adena", type: "item-misc", count: 15230 }),
    item({ name: "Leather Helmet", type: "item-armor" }),
    item({ name: "Leather Gaiters", type: "item-armor" }),
    item({ name: "Leather Boots", type: "item-armor" }),
    item({ name: "Long Sword", type: "item-weapon" }),
    item({ name: "Ring of the Beginner", type: "item-jewelry" }),
    item({ name: "Necklace of Knowledge", type: "item-jewelry" }),
    item({ name: "Earring of Wisdom", type: "item-jewelry" }),
    item({ name: "Bracelet of Fortitude", type: "item-jewelry" }),
  ];
}

// The character roster itself lives in SessionStore.characters (real L2User[]
// from the server) -- this store only tracks which one is active, plus
// in-game-only state that has nothing to do with the account's character list.
export class GameStore {
  creatures = new Map<string, Creature>();
  /** ObjectId of the character entered world with, once Start actually succeeds. */
  me: number | undefined = undefined;
  /** ObjectId of the character highlighted on the char-select screen. */
  selectedCharacterId: number | undefined = undefined;
  hotbarSlots: (IconSlotType | undefined)[] = createDemoHotbar();
  inventoryItems: InventoryItem[] = createDemoInventory();

  constructor() {
    makeAutoObservable(this);
  }

  selectCharacter(id: number | undefined) {
    this.selectedCharacterId = id;
  }

  setActiveCharacter(id: number | undefined) {
    this.me = id;
  }
}
