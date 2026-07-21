import { makeAutoObservable } from "mobx";
import { L2Item, L2Skill, L2Buff, ItemType2, ItemGrade } from "@lineage2js/network";
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
  type2: ItemType2;
  bodyPart?: number;
  count?: number;
  grade?: ItemGrade;
}

// Builds a real L2Item, same shape a server ItemList/InventoryUpdate packet
// would produce -- only ObjectId/ItemId/Type2/BodyPart/Count/IsQuest/Grade are
// set, everything else stays at its default like an unread wire field would.
// No Name: that's resolved from the item-name table via t("item.name.<id>"),
// same as it would be for real server data (see config/item-mapping.ts).
function demoItem({ id, type2, bodyPart, count, grade }: DemoItemInit): L2Item {
  const item = new L2Item();
  item.ObjectId = nextObjectId++;
  item.Id = id;
  item.Type2 = type2;
  item.BodyPart = bodyPart ?? L2Item.SLOT_NONE;
  item.Count = count ?? 1;
  item.IsQuest = type2 === ItemType2.QuestItem;
  item.Grade = grade ?? ItemGrade.None;
  return item;
}

// Real item ids (see the item-name table this pairs with), picked to cover
// one example of every inventory tab/slot type.
function createDemoInventory(): L2Item[] {
  return [
    demoItem({ id: 727, type2: ItemType2.Item, count: 25 }), // Healing Potion
    demoItem({ id: 728, type2: ItemType2.Item, count: 10 }), // Mana Potion
    demoItem({ id: 1869, type2: ItemType2.Item, count: 47 }), // Iron Ore
    demoItem({ id: 702, type2: ItemType2.Item, count: 132 }), // Wolf Pelt
    demoItem({ id: 987, type2: ItemType2.QuestItem, count: 1 }), // Ancient Clay Tablet
    demoItem({ id: 57, type2: ItemType2.Adena, count: 15230 }), // Adena
    demoItem({ id: 44, type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_HEAD, grade: ItemGrade.D }), // Leather Helmet
    demoItem({ id: 33, type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_LEGS, grade: ItemGrade.D }), // Hard Leather Gaiters
    demoItem({ id: 40, type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_FEET, grade: ItemGrade.D }), // Leather Boots
    demoItem({ id: 2, type2: ItemType2.Weapon, bodyPart: L2Item.SLOT_R_HAND, grade: ItemGrade.D }), // Long Sword
    demoItem({ id: 875, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_FINGER }), // Ring of Knowledge
    demoItem({ id: 906, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_NECK }), // Necklace of Knowledge
    demoItem({ id: 115, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_EAR }), // Earring of Wisdom
    demoItem({ id: 9589, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_BRACELET }), // Iron Bracelet
  ];
}

interface DemoSkillInit {
  id: number;
  level: number;
  isActive: boolean;
  mp?: number;
}

// Builds a real L2Skill, same shape a server SkillList packet would produce.
// No Name: resolved from the skill-name table via t("skill.name.<id>"), same
// as items (see config/skill-mapping.ts).
function demoSkill({ id, level, isActive, mp }: DemoSkillInit): L2Skill {
  const skill = new L2Skill();
  skill.Id = id;
  skill.Level = level;
  skill.IsActive = isActive;
  skill.IsDisabled = false;
  skill.IsEnchanted = false;
  skill.Mp = mp ?? 0;
  return skill;
}

// Real skill ids (see the skill-name table this pairs with), mixing active
// and passive skills.
function createDemoSkills(): L2Skill[] {
  return [
    demoSkill({ id: 3, level: 1, isActive: true, mp: 8 }), // Power Strike
    demoSkill({ id: 19, level: 1, isActive: true, mp: 10 }), // Double Shot
    demoSkill({ id: 30, level: 1, isActive: true, mp: 12 }), // Backstab
    demoSkill({ id: 56, level: 1, isActive: true, mp: 10 }), // Power Shot
    demoSkill({ id: 58, level: 1, isActive: true, mp: 15 }), // Elemental Heal
    demoSkill({ id: 147, level: 1, isActive: false }), // Magic Resistance
    demoSkill({ id: 143, level: 1, isActive: false }), // Cubic Mastery
    demoSkill({ id: 194, level: 1, isActive: false }), // Lucky
  ];
}

// Builds a real L2Buff, same shape AbnormalStatusUpdate's readImpl() would
// produce (Id/SkillLevel/RemainingTime). No Name: a buff is just an active
// skill instance, resolved through the same t("skill.name.<id>") table
// (see skill-mapping.ts's getSkillName()).
function demoBuff(id: number, level: number, remainingSeconds: number): L2Buff {
  const buff = new L2Buff(id, level);
  buff.RemainingTime = remainingSeconds;
  return buff;
}

// Real buff skill ids (see the skill-name table this pairs with).
function createDemoBuffs(): L2Buff[] {
  return [
    demoBuff(1204, 1, 1200), // Wind Walk
    demoBuff(1086, 3, 1200), // Haste
    demoBuff(1045, 1, 1200), // Bless the Body
    demoBuff(1048, 1, 1200), // Bless the Soul
    demoBuff(1040, 1, 1200), // Shield
    demoBuff(871, 1, 1200), // Might
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
  skills: L2Skill[] = createDemoSkills();
  buffs: L2Buff[] = createDemoBuffs();

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
