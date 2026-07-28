import { makeAutoObservable, runInAction } from "mobx";
import {
  L2Item,
  L2Skill,
  L2Buff,
  L2Shortcut,
  L2PartyMember,
  L2Character,
  L2Creature,
  L2Mob,
  L2Summon,
  ItemType2,
  ItemGrade,
  ShortcutType,
  ClassId,
  AcquireSkillType,
  type Client,
  type ESystemMessage,
} from "@lineage2js/network";
import { getNpcRace, type NpcRace } from "../config/npc-race-mapping";
import { getClassLabel } from "../config/class-tree";
import { getNpcLevel } from "../config/npc-level-mapping";
import { formatSystemMessage } from "../config/system-message-mapping";

export interface Creature {
  id: string;
}

export const MAX_CHARACTERS = 7;

const HOTBAR_SLOT_COUNT = 48; // 4 rows x 12 columns, matches the wire's slot + page*12 addressing

// H5-era vitality system: raw points shown as a single 0-100% bar (not the
// later Vitality Herb chronicles' 140000/5-level system). Matches
// lineage2ts's VitalityPointsPerLevel.Top -- the hard cap both
// PcStats.setVitalityPoints() and addVitalityPoints() clamp `vp` to (see
// game-server/source/gameService/enums/VitalityLevels.ts and
// .../models/actor/stat/PcStats.ts in the lineage2ts repo linked from
// packages/network/README.md). Confirm against the target server if it differs.
export const MAX_VITALITY_POINTS = 20000;

// Vitality level boundaries (VitalityPointsPerLevel.{Two,Three,Four} in the
// H5 reference server, out of MAX_VITALITY_POINTS) -- each level bumps the
// server's XP-gain rate multiplier (PcStats.getVitalityMultiplier()). Used
// as StatBar `dividers` for the vitality bar wherever it's shown. The
// One/None boundary at 240 (1.2%) is skipped -- too thin to read as a
// marker at typical bar widths.
export const VITALITY_LEVEL_MARKERS = [2000, 13000, 17000].map((points) => (points / MAX_VITALITY_POINTS) * 100);

export interface CharInfoSnapshot {
  name: string;
  level: number;
  cp: number;
  maxCp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  vitalityPercent: number;
  sp: number;
  /** Remaining daily recommendations this character can give out, see GameStore.recommend(). */
  recommLeft: number;
  // --- Below: only consumed by the "character" window's full stats panel
  // (components/windows/character/character.window.tsx) -- the compact
  // char-info/party-char-info sidebars only use the fields above.
  /** L2Character.Title, e.g. a clan/quest title -- empty string when none set. */
  title: string;
  className: string;
  /** 0 when clanless -- resolve the name via GameStore.pledgeCache, same as targetSnapshotFromCreature. */
  clanId: number;
  expPercent: number;
  load: number;
  maxLoad: number;
  /** Recommendations this character has received so far (L2Creature.RecommHave). */
  recommHave: number;
  fame: number;
  karma: number;
  pvpKills: number;
  pkKills: number;
  pAtk: number;
  pDef: number;
  accuracy: number;
  evasion: number;
  critical: number;
  atkSpd: number;
  speed: number;
  mAtk: number;
  mDef: number;
  /**
   * Magic accuracy/evasion/critical have no source anywhere in the network
   * layer yet -- no packet parses them (see packages/network/src/entities
   * and network/incoming/game/UserInfo.ts), so syncCharInfo leaves these
   * unset and character.window.tsx hides their rows entirely instead of
   * showing a misleading 0. Demo mode fills in plausible numbers instead.
   */
  mAccuracy?: number;
  mEvasion?: number;
  mCritical?: number;
  castingSpd: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
  /**
   * Cumulative delta from equipped Henna dyes (see L2User.HennaSTR -- can be
   * negative, each dye trades a bonus on one stat for a penalty on another).
   * Arrives via a separate HennaInfo packet sent right after world-enter,
   * not part of UserInfo/CharSelected, so these start at 0 and get filled in
   * a moment later (see the "HennaInfo" PacketReceived listener below).
   */
  hennaStr: number;
  hennaDex: number;
  hennaCon: number;
  hennaInt: number;
  hennaWit: number;
  hennaMen: number;
}

// Same demo-first treatment as hotbar/inventory/skills/buffs -- shows
// something reasonable in the char-info window before any real UserInfo/
// StatusUpdate packet has arrived.
function createDemoCharInfo(): CharInfoSnapshot {
  return {
    name: "DemoHero",
    level: 40,
    cp: 850,
    maxCp: 1200,
    hp: 2400,
    maxHp: 3100,
    mp: 900,
    maxMp: 1400,
    vitalityPercent: (15000 / MAX_VITALITY_POINTS) * 100,
    sp: 12500,
    recommLeft: 5,
    title: "the Novice",
    className: "Duelist",
    clanId: 1001, // matches createDemoPledgeCache()'s "Aden Vanguards" entry below
    expPercent: 42.5,
    load: 18400,
    maxLoad: 34500,
    recommHave: 3,
    fame: 120,
    karma: 0,
    pvpKills: 12,
    pkKills: 0,
    pAtk: 312,
    pDef: 245,
    accuracy: 34,
    evasion: 32,
    critical: 12,
    atkSpd: 320,
    speed: 128,
    mAtk: 180,
    mDef: 210,
    mAccuracy: 45,
    mEvasion: 40,
    mCritical: 15,
    castingSpd: 280,
    str: 40,
    dex: 30,
    con: 38,
    int: 21,
    wit: 20,
    men: 25,
    // Mirrors a real dye tradeoff (see hennaList.xml dyeId=1: str +1/con -3)
    // -- demonstrates both the positive and negative rendering branches.
    hennaStr: 3,
    hennaDex: 0,
    hennaCon: -3,
    hennaInt: 0,
    hennaWit: 0,
    hennaMen: 1,
  };
}

// Builds a real L2Shortcut, same shape ShortCutInit/ShortCutRegister would
// produce (Slot/Type/TargetId[/Level]). No name/icon on the entity itself --
// resolved from the item/skill tables via config/shortcut-mapping.ts, same
// as everywhere else.
function demoShortcut(slot: number, type: ShortcutType, targetId: number, level?: number): L2Shortcut {
  const shortcut = new L2Shortcut();
  shortcut.Slot = slot;
  shortcut.Type = type;
  shortcut.TargetId = targetId;
  if (level !== undefined) {
    shortcut.Level = level;
  }
  return shortcut;
}

// One example of every real ShortcutType, referencing the same demo
// item/skill ids as createDemoInventory()/createDemoSkills().
function createDemoHotbarShortcuts(): (L2Shortcut | undefined)[] {
  const slots: (L2Shortcut | undefined)[] = new Array(HOTBAR_SLOT_COUNT).fill(undefined);
  slots[0] = demoShortcut(0, ShortcutType.SKILL, 3, 1); // Power Strike
  slots[1] = demoShortcut(1, ShortcutType.ACTION, 0);
  slots[2] = demoShortcut(2, ShortcutType.MACRO, 0);
  slots[3] = demoShortcut(3, ShortcutType.ITEM, 727); // Healing Potion (item-misc)
  slots[4] = demoShortcut(4, ShortcutType.ITEM, 2); // Long Sword (item-weapon)
  slots[5] = demoShortcut(5, ShortcutType.ITEM, 44); // Leather Helmet (item-armor)
  slots[6] = demoShortcut(6, ShortcutType.ITEM, 875); // Ring of Knowledge (item-jewelry)
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

// The "Learn" tab's data source -- skills not yet acquired. Real entries
// come from AcquireSkillList (filtered to AcquireSkillType.CLASS), which
// carries no minimum-character-level field at all (the server simply never
// offers a skill you're ineligible for), so minLevel is demo-only and left
// undefined for real-synced entries. requiredItem also starts undefined for
// real entries -- AcquireSkillList only carries a requirements *count*, the
// actual item/quantity only arrives via AcquireSkillInfo once the skill is
// selected (see selectLearnableSkill/syncSkillRequirements).
export interface LearnableSkillSnapshot {
  id: number;
  level: number;
  minLevel?: number;
  costSp: number;
  requiredItem?: { id: number; count: number };
}

function createDemoLearnableSkills(): LearnableSkillSnapshot[] {
  return [
    { id: 256, level: 1, minLevel: 40, costSp: 3000 }, // Accuracy
    { id: 1191, level: 1, minLevel: 40, costSp: 5000, requiredItem: { id: 1869, count: 10 } }, // Resist Fire -- Iron Ore x10, already in the demo inventory
    { id: 1002, level: 1, minLevel: 42, costSp: 8000, requiredItem: { id: 6622, count: 1 } }, // Flame Chant -- an item NOT in the demo inventory
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

interface DemoPartyMemberInit {
  objectId: number;
  name: string;
  level: number;
  classId: ClassId;
  cp: number;
  maxCp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  isPartyLeader?: boolean;
}

// Builds a real L2PartyMember, same shape PartySmallWindowAll/Add/Update would
// produce. One of each class-role icon (warrior/mage/summoner/archer/tank/
// healer/buffer/rogue) for the party window (see class-tree.ts's getClassRole()).
function demoPartyMember({
  objectId,
  name,
  level,
  classId,
  cp,
  maxCp,
  hp,
  maxHp,
  mp,
  maxMp,
  isPartyLeader,
}: DemoPartyMemberInit): L2PartyMember {
  const member = new L2PartyMember();
  member.ObjectId = objectId;
  member.Name = name;
  member.Level = level;
  member.ClassId = classId;
  member.Cp = cp;
  member.MaxCp = maxCp;
  member.Hp = hp;
  member.MaxHp = maxHp;
  member.Mp = mp;
  member.MaxMp = maxMp;
  member.IsPartyLeader = isPartyLeader ?? false;
  return member;
}

export type CreatureKind = "mob" | "npc" | "summon";

export interface TargetSnapshot {
  objectId: number;
  name: string;
  hp: number;
  maxHp: number;
  isDead: boolean;
  buffs: L2Buff[];
  // Player-specific (only set for L2Character targets -- party members, other
  // PCs). Clan/ally are only filled once a name is actually known (see
  // pledgeCache below); a nonzero ClanId with no cached name still hides the
  // row, since there's nothing real to show yet.
  title?: string;
  clanName?: string;
  allyName?: string;
  // Numeric crest ids, straight off the wire (see L2Character.ClanCrestId/
  // AllyCrestId) -- not rendered yet, no crest image fetch/decode pipeline
  // exists (crests are a raw bitmap, requested via a separate packet pair
  // this codebase doesn't implement). Kept 0 rather than undefined to match
  // the wire's "no crest" value.
  clanCrestId?: number;
  allyCrestId?: number;
  // Recommendations this player has received so far (see GameStore.recommend()) --
  // only meaningful for player targets, hence only set alongside title/clanName/allyName.
  recommHave?: number;
  // Non-player creature kind (L2Mob/L2Npc/L2Summon), for a type icon --
  // only set when the target is NOT a player.
  creatureKind?: CreatureKind;
  // Non-player race (see config/npc-race-mapping.ts), resolved from the
  // npc template id -- only known for ids present in the datapack-derived
  // table (mostly Monster-type npcs; Folk/quest-givers usually have none).
  // Falls back to creatureKind's icon when this is undefined.
  race?: NpcRace;
  // Non-player level only (see config/npc-level-mapping.ts) -- intentionally
  // not set for L2Character targets (players already show their own level
  // via char-info/party-char-info, and their nameplate isn't con-colored).
  level?: number;
}

export interface PledgeSnapshot {
  ClanName: string;
  AllyName: string;
}

// Real clan/ally names never travel with CharInfo/PartySmallWindow (only
// numeric ClanId does) -- they only arrive via a PledgeInfo packet, keyed by
// clanId (see Client.PledgeInfoByClanId). There's no outgoing request wired
// yet to fetch one on demand, so this cache only fills from whatever
// PledgeInfo happens to arrive.
function createDemoPledgeCache(): Map<number, PledgeSnapshot> {
  return new Map([[1001, { ClanName: "Aden Vanguards", AllyName: "Kingdom Alliance" }]]);
}

// Target-select window's data source -- the currently targeted creature,
// wherever it came from (party member click, or a real MyTargetSelected).
function targetSnapshotFromCreature(creature: L2Creature, pledgeCache: Map<number, PledgeSnapshot>): TargetSnapshot {
  const base = {
    objectId: creature.ObjectId,
    name: creature.Name,
    hp: creature.Hp,
    maxHp: creature.MaxHp,
    isDead: creature.IsDead,
    buffs: Array.from(creature.Buffs),
  };

  if (creature instanceof L2Character) {
    const pledge = creature.ClanId ? pledgeCache.get(creature.ClanId) : undefined;
    return {
      ...base,
      title: creature.Title || undefined,
      clanName: pledge?.ClanName,
      allyName: pledge?.AllyName,
      clanCrestId: creature.ClanCrestId,
      allyCrestId: creature.AllyCrestId,
      recommHave: creature.RecommHave,
    };
  }

  return {
    ...base,
    creatureKind: creature instanceof L2Mob ? "mob" : creature instanceof L2Summon ? "summon" : "npc",
    race: getNpcRace(creature.Id),
    level: getNpcLevel(creature.Id),
  };
}

export interface BattleLogEntry {
  id: number;
  text: string;
}

let nextBattleLogEntryId = 1;
const BATTLE_LOG_MAX_ENTRIES = 200;

// SystemMessage is the wire's only channel for combat text, but it's also
// used for mail/trade/guild/etc -- real L2 routes each messageId to a chat
// tab client-side (there's no channel tag on the wire itself). This is a
// curated subset of combat-relevant ids standing in for that routing until
// a fuller one exists; see public/system-messages/en.json for the full
// L2J_Mobius-sourced id->template table this pulls display text from.
const BATTLE_LOG_MESSAGE_IDS = new Set([
  35, // You hit for $s1 damage.
  36, // $c1 hit you for $s2 damage.
  37, // $c1 hit you for $s2 damage.
  42, // You have avoided $c1's attack.
  43, // You have missed.
  44, // Critical hit!
  1280, // Magic Critical Hit!
  1999, // $c1 dodges the attack.
  2261, // $c1 has done $s3 points of damage to $c2.
  2262, // $c1 has received $s3 damage from $c2.
  2264, // $c1 has evaded $c2's attack.
  2266, // $c1 landed a critical hit!
  2269, // $c1 resisted $c2's magic.
  2344, // You have been killed by an attack from $c1.
  2345, // You have attacked and killed $c1.

  // Vitality level changes (confirmed against lineage2ts's PcStats.ts --
  // sent from updateVitalityLevel() only, i.e. NOT on every ordinary solo
  // kill's vitality drain (that path calls addVitalityPoints with
  // sendUpdate=false); real triggers are the periodic online regen tick,
  // party-kill vitality gains, and Vitality Herb-style skill effects).
  2314, // Your Vitality is at maximum.
  2315, // Your Vitality has increased.
  2316, // Your Vitality has decreased.
  2317, // Your Vitality is fully exhausted.
]);

function demoBattleLogEntry(text: string): BattleLogEntry {
  return { id: nextBattleLogEntryId++, text };
}

// Same demo-first treatment as everywhere else -- a few representative
// lines before any real SystemMessage has arrived.
function createDemoBattleLog(): BattleLogEntry[] {
  return [
    demoBattleLogEntry("You hit for 245 damage."),
    demoBattleLogEntry("Critical hit!"),
    demoBattleLogEntry("Ant Soldier has evaded your attack."),
    demoBattleLogEntry("You have attacked and killed Ant Soldier."),
  ];
}

function createDemoParty(): L2PartyMember[] {
  const hero = demoPartyMember({
    objectId: 90001,
    name: "DemoHero",
    level: 40,
    classId: ClassId.Gladiator,
    cp: 850,
    maxCp: 1200,
    hp: 2400,
    maxHp: 3100,
    mp: 900,
    maxMp: 1400,
    isPartyLeader: true,
  });
  hero.Buffs.add(demoBuff(1086, 3, 1200)); // Haste
  hero.Buffs.add(demoBuff(1040, 1, 1200)); // Shield
  hero.Title = "Vanguard of Aden";
  hero.ClanId = 1001; // matches createDemoPledgeCache()'s seeded entry

  const sorc = demoPartyMember({
    objectId: 90002,
    name: "DemoSorc",
    level: 38,
    classId: ClassId.Sorceror,
    cp: 0,
    maxCp: 700,
    hp: 1400,
    maxHp: 1900,
    mp: 2100,
    maxMp: 2600,
  });
  sorc.Buffs.add(demoBuff(1204, 1, 1200)); // Wind Walk
  sorc.RecommHave = 12; // shows the recommend row/button in the target-select window

  const ranger = demoPartyMember({
    objectId: 90003,
    name: "DemoRanger",
    level: 39,
    classId: ClassId.SilverRanger,
    cp: 400,
    maxCp: 900,
    hp: 1800,
    maxHp: 2400,
    mp: 1200,
    maxMp: 1600,
  });

  const warlock = demoPartyMember({
    objectId: 90004,
    name: "DemoWarlock",
    level: 38,
    classId: ClassId.Warlock,
    cp: 0,
    maxCp: 650,
    hp: 1300,
    maxHp: 1800,
    mp: 2000,
    maxMp: 2500,
  });
  warlock.Buffs.add(demoBuff(1045, 1, 1200)); // Bless the Body
  warlock.Buffs.add(demoBuff(1048, 1, 1200)); // Bless the Soul
  warlock.Buffs.add(demoBuff(871, 1, 1200)); // Might

  const paladin = demoPartyMember({
    objectId: 90005,
    name: "DemoPaladin",
    level: 40,
    classId: ClassId.PhoenixKnight,
    cp: 900,
    maxCp: 1300,
    hp: 3200,
    maxHp: 4000,
    mp: 1000,
    maxMp: 1500,
  });

  const cardinal = demoPartyMember({
    objectId: 90006,
    name: "DemoCardinal",
    level: 40,
    classId: ClassId.Cardinal,
    cp: 0,
    maxCp: 750,
    hp: 1500,
    maxHp: 2000,
    mp: 2400,
    maxMp: 2900,
  });

  const dancer = demoPartyMember({
    objectId: 90007,
    name: "DemoDancer",
    level: 39,
    classId: ClassId.SwordMuse,
    cp: 300,
    maxCp: 850,
    hp: 1700,
    maxHp: 2300,
    mp: 1600,
    maxMp: 2100,
  });

  const adventurer = demoPartyMember({
    objectId: 90008,
    name: "DemoAdventurer",
    level: 39,
    classId: ClassId.Adventurer,
    cp: 500,
    maxCp: 950,
    hp: 1900,
    maxHp: 2500,
    mp: 1100,
    maxMp: 1500,
  });

  return [hero, sorc, ranger, warlock, paladin, cardinal, dancer, adventurer];
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
  hotbarSlots: (L2Shortcut | undefined)[] = createDemoHotbarShortcuts();
  inventoryItems: L2Item[] = createDemoInventory();
  skills: L2Skill[] = createDemoSkills();
  buffs: L2Buff[] = createDemoBuffs();
  charInfo: CharInfoSnapshot = createDemoCharInfo();
  party: L2PartyMember[] = createDemoParty();
  /** Currently selected attack/spell/buff target, if any -- see target-select window. */
  target: TargetSnapshot | undefined = undefined;
  /** clanId -> resolved name, filled in as PledgeInfo packets arrive. See targetSnapshotFromCreature. */
  pledgeCache: Map<number, PledgeSnapshot> = createDemoPledgeCache();
  /** Combat text feed, see battlelog window and BATTLE_LOG_MESSAGE_IDS. */
  battleLog: BattleLogEntry[] = createDemoBattleLog();
  /** Skills-list "Learn" tab data, see LearnableSkillSnapshot. */
  learnableSkills: LearnableSkillSnapshot[] = createDemoLearnableSkills();
  /** Currently open in the "skill" detail window, if any. */
  selectedLearnableSkill: LearnableSkillSnapshot | undefined = undefined;
  /** Set once by bindToClient -- used by selectTarget/clearTarget to dispatch outgoing packets. */
  client: Client | undefined;

  constructor() {
    makeAutoObservable(this, { client: false });
  }

  selectCharacter(id: number | undefined) {
    this.selectedCharacterId = id;
  }

  setActiveCharacter(id: number | undefined) {
    this.me = id;
  }

  /**
   * Selects a party member as the current target: sends the real Action
   * (select) packet so the server knows, and immediately snapshots the
   * already-known member data so the target-select window shows without
   * waiting for a MyTargetSelected/StatusUpdate round-trip.
   */
  selectTarget(member: L2PartyMember) {
    if (this.client?.GameClient.IsConnected) {
      this.client.hit(member);
    }
    this.target = targetSnapshotFromCreature(member, this.pledgeCache);
  }

  clearTarget() {
    if (this.client?.GameClient.IsConnected) {
      this.client.cancelTarget();
    }
    this.target = undefined;
  }

  /**
   * Recommends the current target (RequestVoteNew) -- only valid for player
   * targets (target.recommHave is only ever set for those, see
   * targetSnapshotFromCreature) while recommLeft is still positive. When
   * connected, the server's ExVoteSystemInfo reply is what actually updates
   * charInfo.recommLeft (see the ExVoteSystemInfo sync handler); the
   * target's own recommHave only refreshes next time their CharInfo/
   * MyTargetSelected arrives, same limitation as PledgeInfoByClanId.
   * Offline/demo mode simulates both counters locally instead.
   */
  recommend() {
    const target = this.target;
    if (!target || target.creatureKind || this.charInfo.recommLeft <= 0) {
      return;
    }

    if (this.client?.GameClient.IsConnected) {
      this.client.recommend(target.objectId);
      return;
    }

    this.charInfo = { ...this.charInfo, recommLeft: this.charInfo.recommLeft - 1 };
    this.target = { ...target, recommHave: (target.recommHave ?? 0) + 1 };
  }

  /**
   * Opens the skill's detail window and, when connected, asks the trainer
   * for its authoritative SpCost/Requirements (RequestAcquireSkillInfo) --
   * syncSkillRequirements picks up the AcquireSkillInfo reply and fills in
   * requiredItem. Offline/demo mode just uses the snapshot as-is.
   */
  selectLearnableSkill(skill: LearnableSkillSnapshot) {
    this.selectedLearnableSkill = skill;
    if (this.client?.GameClient.IsConnected) {
      this.client.requestAcquireSkillInfo(skill.id, skill.level, AcquireSkillType.CLASS);
    }
  }

  clearSelectedLearnableSkill() {
    this.selectedLearnableSkill = undefined;
  }

  hasRequiredItem(requiredItem: { id: number; count: number }): boolean {
    return this.inventoryItems.some((item) => item.Id === requiredItem.id && item.Count >= requiredItem.count);
  }

  /**
   * When connected, commits to learning the skill server-side
   * (RequestAcquireSkill) and optimistically closes the window -- the
   * server's AcquireSkillDone/fresh SkillList/AcquireSkillList/UserInfo
   * packets are what actually move the skill from learnableSkills into
   * skills and deduct Sp (see the bindToClient sync handlers).
   *
   * Offline/demo mode has no server to do that, so it keeps simulating the
   * same result locally (moves the skill into skills, deducts SP) exactly
   * as before.
   */
  learnSelectedSkill() {
    const skill = this.selectedLearnableSkill;
    if (!skill) {
      return;
    }
    if (this.charInfo.sp < skill.costSp) {
      return;
    }
    if (skill.requiredItem && !this.hasRequiredItem(skill.requiredItem)) {
      return;
    }

    if (this.client?.GameClient.IsConnected) {
      this.client.requestAcquireSkill(skill.id, skill.level, AcquireSkillType.CLASS);
      this.selectedLearnableSkill = undefined;
      return;
    }

    this.charInfo = { ...this.charInfo, sp: this.charInfo.sp - skill.costSp };
    this.learnableSkills = this.learnableSkills.filter((s) => s !== skill);
    this.skills = [...this.skills, demoSkill({ id: skill.id, level: skill.level, isActive: true })];
    this.selectedLearnableSkill = undefined;
  }

  private recordBattleLogMessage(messageId: number, params: unknown[], paramTypes: number[]) {
    if (!BATTLE_LOG_MESSAGE_IDS.has(messageId)) {
      return;
    }
    const text = formatSystemMessage(messageId, params, paramTypes);
    this.battleLog = [...this.battleLog, { id: nextBattleLogEntryId++, text }].slice(-BATTLE_LOG_MAX_ENTRIES);
  }

  /**
   * Mirrors the network layer's live collections (Client.InventoryItems/
   * SkillsList/BuffsList/Shortcuts -- plain Sets the mutators write into on
   * every incoming packet) into these observable arrays, replacing the demo
   * data the moment the server actually sends something. Called once from
   * RootStore against the app's single long-lived Client instance.
   */
  bindToClient(client: Client) {
    this.client = client;

    const syncInventory = () => runInAction(() => {
      this.inventoryItems = Array.from(client.InventoryItems);
    });
    const syncSkills = () => runInAction(() => {
      this.skills = Array.from(client.SkillsList);
    });
    const syncBuffs = () => runInAction(() => {
      this.buffs = Array.from(client.BuffsList);
    });
    const syncHotbar = () => runInAction(() => {
      const slots: (L2Shortcut | undefined)[] = new Array(HOTBAR_SLOT_COUNT).fill(undefined);
      client.Shortcuts.forEach((shortcut) => {
        if (shortcut.Slot < HOTBAR_SLOT_COUNT) {
          slots[shortcut.Slot] = shortcut;
        }
      });
      this.hotbarSlots = slots;
    });
    const syncCharInfo = () => runInAction(() => {
      const me = client.Me;
      this.charInfo = {
        name: me.Name,
        level: me.Level,
        cp: me.Cp,
        maxCp: me.MaxCp,
        hp: me.Hp,
        maxHp: me.MaxHp,
        mp: me.Mp,
        maxMp: me.MaxMp,
        vitalityPercent: (me.VitalityPoints / MAX_VITALITY_POINTS) * 100,
        sp: me.Sp,
        recommLeft: me.RecommLeft,
        title: me.Title,
        className: getClassLabel(me.ClassId),
        clanId: me.ClanId,
        expPercent: me.ExpPercent,
        load: me.Load,
        maxLoad: me.MaxLoad,
        recommHave: me.RecommHave,
        fame: me.Fame,
        karma: me.Karma,
        pvpKills: me.PvpKills,
        pkKills: me.PkKills,
        pAtk: me.PAtk,
        pDef: me.PDef,
        accuracy: me.Accuracy,
        evasion: me.EvasionRate,
        critical: me.Crit,
        atkSpd: me.PAtkSpd,
        speed: me.RunSpeed,
        mAtk: me.MAtk,
        mDef: me.MDef,
        // mAccuracy/mEvasion/mCritical intentionally omitted -- see the
        // CharInfoSnapshot field comments, not exposed by the wire.
        castingSpd: me.MAtkSpd,
        str: me.STR,
        dex: me.DEX,
        con: me.CON,
        int: me.INT,
        wit: me.WIT,
        men: me.MEN,
        // HennaInfo (see below) arrives separately and may not have landed
        // yet -- these stay 0 until it does, same "fills in a moment later"
        // treatment as the rest of the world-enter burst.
        hennaStr: me.HennaSTR ?? 0,
        hennaDex: me.HennaDEX ?? 0,
        hennaCon: me.HennaCON ?? 0,
        hennaInt: me.HennaINT ?? 0,
        hennaWit: me.HennaWIT ?? 0,
        hennaMen: me.HennaMEN ?? 0,
      };
    });

    client.on("PacketReceived", "ItemList", syncInventory);
    client.on("PacketReceived", "InventoryUpdate", syncInventory);
    client.on("PacketReceived", "SkillList", syncSkills);
    client.on("PacketReceived", "SkillCoolTime", syncSkills);
    client.on("PacketReceived", "AbnormalStatusUpdate", syncBuffs);
    client.on("PacketReceived", "ShortCutInit", syncHotbar);
    client.on("PacketReceived", "ShortCutRegister", syncHotbar);
    client.on("PacketReceived", "ShortCutDelete", syncHotbar);
    client.on("PacketReceived", "CharSelected", syncCharInfo);
    client.on("PacketReceived", "UserInfo", syncCharInfo);
    // Henna stat bonuses arrive via their own packet, sent right after
    // world-enter (see EnterWorld.java in the H5 reference server) --
    // re-snapshot once it lands instead of waiting for the next UserInfo.
    client.on("PacketReceived", "HennaInfo", syncCharInfo);
    // Vitality regen while resting in a peace zone only pushes this packet
    // (see VitalityTask.java), not a full UserInfo/StatusUpdate -- without
    // this the vitality bar would sit still until some unrelated stat change
    // happened to trigger a refresh.
    client.on("PacketReceived", "ExVitalityPointInfo", syncCharInfo);
    client.on("PacketReceived", "StatusUpdate", syncCharInfo);
    // ExVoteSystemInfo is the only packet that updates RecommLeft after
    // world-enter (sent right after a successful RequestVoteNew).
    client.on("PacketReceived", "ExVoteSystemInfo", syncCharInfo);

    const syncParty = () => runInAction(() => {
      this.party = Array.from(client.PartyList);
    });
    // "PartySmallWindow" fires for every add/add-all/update/delete/delete-all
    // (see the PartySmallWindow*Mutators), one event instead of subscribing
    // to each of the five packet names separately.
    client.on("PartySmallWindow", syncParty);
    // Solo characters never get a single PartySmallWindow* packet, so without
    // this the demo party would linger forever -- UserInfo (world-enter) is
    // the same "definitely in game now" signal syncCharInfo uses, and
    // client.PartyList is correctly empty when not partied.
    client.on("PacketReceived", "UserInfo", syncParty);
    // PartySpelledMutator mutates a member's own Buffs collection in place
    // (clear+add), which doesn't change the party array's identity -- without
    // this, party members' buff icons wouldn't ever re-render after the
    // initial snapshot.
    client.on("PartySpelled", syncParty);

    const syncTarget = () => runInAction(() => {
      const targetObj = client.Me.Target;
      this.target = targetObj instanceof L2Creature ? targetSnapshotFromCreature(targetObj, this.pledgeCache) : undefined;
    });
    const clearTarget = () => runInAction(() => {
      this.target = undefined;
    });

    client.on("MyTargetSelected", syncTarget);
    client.on("MyTargetUnselected", clearTarget);
    // Keeps the target's HP/MP bars live as StatusUpdate packets arrive for
    // any tracked creature -- client.Me.Target is the same object reference
    // StatusUpdateMutator mutates in place, so re-snapshotting is cheap and
    // correct even when the update was for a different creature.
    client.on("PacketReceived", "StatusUpdate", syncTarget);
    // No outgoing request is wired to populate client.PledgeInfoByClanId on
    // demand yet -- this only ever fires from whatever PledgeInfo the server
    // happens to send unprompted, but if it names the current target's clan,
    // re-snapshot so the clan/ally rows pick it up without a re-select.
    client.on("PacketReceived", "PledgeInfo", () => runInAction(() => {
      this.pledgeCache = new Map(
        Array.from(client.PledgeInfoByClanId, ([clanId, info]) => [clanId, { ClanName: info.ClanName, AllyName: info.AllyName }])
      );
      syncTarget();
    }));

    client.on("SystemMessage", (e: ESystemMessage) => {
      runInAction(() => this.recordBattleLogMessage(e.data.messageId, e.data.params, e.data.paramTypes));
    });

    // Real Learn-tab data source -- replaces the demo learnableSkills list
    // the moment the server sends one. Only AcquireSkillType.CLASS is shown
    // here (fishing/pledge/transform/etc. skill-learn use the same packet
    // but belong to other UI, not yet built).
    const syncLearnableSkills = () => runInAction(() => {
      const list = client.AcquireSkillList;
      if (!list || list.Type !== AcquireSkillType.CLASS) {
        return;
      }
      this.learnableSkills = list.Skills.map((entry) => ({
        id: entry.Id,
        level: entry.NextLevel,
        costSp: entry.SpCost,
      }));
    });
    client.on("PacketReceived", "AcquireSkillList", syncLearnableSkills);

    // Fills in the authoritative SpCost/Requirements for whichever skill is
    // currently open in the skill window, once RequestAcquireSkillInfo's
    // reply arrives -- see selectLearnableSkill.
    const syncSkillRequirements = () => runInAction(() => {
      const selected = this.selectedLearnableSkill;
      if (!selected) {
        return;
      }
      const info = client.AcquireSkillInfoByKey.get(`${selected.id}_${selected.level}`);
      if (!info) {
        return;
      }
      const requirement = info.Requirements[0];
      const updated: LearnableSkillSnapshot = {
        ...selected,
        costSp: info.SpCost,
        requiredItem: requirement ? { id: requirement.ItemId, count: requirement.Count } : undefined,
      };
      this.selectedLearnableSkill = updated;
      this.learnableSkills = this.learnableSkills.map((s) =>
        s.id === updated.id && s.level === updated.level ? updated : s
      );
    });
    client.on("PacketReceived", "AcquireSkillInfo", syncSkillRequirements);

    // AcquireSkillDone confirms a successful RequestAcquireSkill -- the
    // server follows up with fresh SkillList/AcquireSkillList/UserInfo
    // packets right after, which syncSkills/syncLearnableSkills/syncCharInfo
    // already pick up, so there's nothing else to do here.
  }
}
