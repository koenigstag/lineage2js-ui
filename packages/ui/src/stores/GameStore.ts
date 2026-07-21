import { makeAutoObservable } from "mobx";
import { L2Item, ItemType2, ItemGrade } from "@lineage2js/network";
import type { IconSlotType } from "../components/core/icon-frame.component";

export interface Creature {
  id: string;
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

let nextObjectId = 1;
interface DemoItemInit {
  id: number;
  name: string;
  type2: ItemType2;
  bodyPart?: number;
  count?: number;
  grade?: ItemGrade;
}

// Builds a real L2Item, same shape a server ItemList/InventoryUpdate packet
// would produce -- only ObjectId/ItemId/Name/Type2/BodyPart/Count/IsQuest/Grade
// are set, everything else stays at its default like an unread wire field would.
function demoItem({ id, name, type2, bodyPart, count, grade }: DemoItemInit): L2Item {
  const item = new L2Item();
  item.ObjectId = nextObjectId++;
  item.Id = id;
  item.Name = name;
  item.Type2 = type2;
  item.BodyPart = bodyPart ?? L2Item.SLOT_NONE;
  item.Count = count ?? 1;
  item.IsQuest = type2 === ItemType2.QuestItem;
  item.Grade = grade ?? ItemGrade.None;
  return item;
}

function createDemoInventory(): L2Item[] {
  return [
    demoItem({ id: 1060, name: "Healing Potion", type2: ItemType2.Item, count: 25 }),
    demoItem({ id: 1061, name: "Mana Potion", type2: ItemType2.Item, count: 10 }),
    demoItem({ id: 1867, name: "Iron Ore", type2: ItemType2.Item, count: 47 }),
    demoItem({ id: 1025, name: "Wolf Pelt", type2: ItemType2.Item, count: 132 }),
    demoItem({ id: 7574, name: "Ancient Map Fragment", type2: ItemType2.QuestItem, count: 1 }),
    demoItem({ id: 57, name: "Adena", type2: ItemType2.Adena, count: 15230 }),
    demoItem({ id: 5, name: "Leather Helmet", type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_HEAD, grade: ItemGrade.D }),
    demoItem({ id: 27, name: "Leather Gaiters", type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_LEGS, grade: ItemGrade.D }),
    demoItem({ id: 12, name: "Leather Boots", type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_FEET, grade: ItemGrade.D }),
    demoItem({ id: 1, name: "Long Sword", type2: ItemType2.Weapon, bodyPart: L2Item.SLOT_R_HAND, grade: ItemGrade.D }),
    demoItem({ id: 970, name: "Ring of the Beginner", type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_FINGER }),
    demoItem({ id: 906, name: "Necklace of Knowledge", type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_NECK }),
    demoItem({ id: 872, name: "Earring of Wisdom", type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_EAR }),
    demoItem({ id: 8317, name: "Bracelet of Fortitude", type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_BRACELET }),
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
  inventoryItems: L2Item[] = createDemoInventory();

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
