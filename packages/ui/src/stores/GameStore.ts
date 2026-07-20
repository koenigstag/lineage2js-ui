import { makeAutoObservable } from "mobx";
import type { IconSlotType } from "../components/core/icon-frame.component";

export interface Character {
  id: string;
  nickname: string;
  race: string;
  baseClass: string;
  sex: string;
  face: string;
  hair: string;
}

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

const CHARACTERS_KEY = "characters";

// Temporary local persistence until characters are served by the game server.
function loadCharacters(): Map<string, Character> {
  const raw = localStorage.getItem(CHARACTERS_KEY);
  const characters: Character[] = raw ? JSON.parse(raw) : [];
  return new Map(characters.map((character) => [character.id, character]));
}

function persistCharacters(characters: Map<string, Character>): void {
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(Array.from(characters.values())));
}

export class GameStore {
  characters = loadCharacters();
  creatures = new Map<string, Creature>();
  me: string | undefined = undefined;
  selectedCharacterId: string | undefined = undefined;
  hotbarSlots: (IconSlotType | undefined)[] = createDemoHotbar();
  inventoryItems: InventoryItem[] = createDemoInventory();

  constructor() {
    makeAutoObservable(this);
  }

  selectCharacter(id: string | undefined) {
    this.selectedCharacterId = id;
  }

  createCharacter(data: Omit<Character, "id">): string {
    const id = crypto.randomUUID();
    this.characters.set(id, { id, ...data });
    persistCharacters(this.characters);
    return id;
  }

  deleteCharacter(id: string) {
    this.characters.delete(id);
    if (this.selectedCharacterId === id) {
      this.selectedCharacterId = undefined;
    }
    persistCharacters(this.characters);
  }

  enterWorld() {
    this.me = this.selectedCharacterId;
  }
}
