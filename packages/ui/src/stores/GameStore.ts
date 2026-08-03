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
  ChatType,
  RestartPoint,
  PartyDistributionType,
  Actions,
  type Client,
  type ESystemMessage,
  type ECreatureSay,
  type EDie,
  type ERevive,
  type EConfirmDlg,
  type EPartyRequest,
  type ETradeRequest,
  type ERequestedDuel,
} from "@lineage2js/network";
import { getNpcRace, type NpcRace } from "../config/npc-race-mapping";
import { getClassLabel } from "../config/class-tree";
import { getNpcLevel } from "../config/npc-level-mapping";
import { getNpcName } from "../config/npc-name-mapping";
import { formatSystemMessage, isNoisySystemMessage } from "../config/system-message-mapping";

/** A nearby NPC/mob/other player as reported by NpcInfo/CharInfo, for the world scene (not the target-select window -- see TargetSnapshot for that). */
export interface WorldCreatureSnapshot {
  objectId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  kind: "player" | "mob" | "summon" | "npc";
  isDead: boolean;
}

/** Own character's live world position, kept fresh by the same poll that refreshes WorldCreatureSnapshot positions (see bindToClient). */
export interface MyPositionSnapshot {
  x: number;
  y: number;
  z: number;
  heading: number;
}

export const MAX_CHARACTERS = 7;

const HOTBAR_SLOT_COUNT = 48; // 4 rows x 12 columns, matches the wire's slot + page*12 addressing

// ExDuelAskStart carries no expiry field on the wire -- the real client
// still shows a countdown on the duel-request popup (unlike party/trade
// invites, which have none), driven purely client-side off the same 15s
// window the reference server enforces server-side against re-requesting
// (Player.REQUEST_TIMEOUT, gameserver/model/actor/Player.java).
const DUEL_REQUEST_TIMEOUT_MS = 15000;

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
// item/skill ids as createDemoInventory()/createDemoSkills(). ITEM shortcuts'
// TargetId is the inventory item's ObjectId, not its template id (see
// config/shortcut-mapping.ts's resolveShortcutItem), so this looks the
// ObjectId up from the already-built demo inventory instead of hardcoding it.
function createDemoHotbarShortcuts(inventoryItems: L2Item[]): (L2Shortcut | undefined)[] {
  const objectIdForItem = (itemId: number): number =>
    inventoryItems.find((item) => item.Id === itemId)?.ObjectId ?? itemId;

  const slots: (L2Shortcut | undefined)[] = new Array(HOTBAR_SLOT_COUNT).fill(undefined);
  slots[0] = demoShortcut(0, ShortcutType.SKILL, 3, 1); // Power Strike
  slots[1] = demoShortcut(1, ShortcutType.ACTION, 0);
  slots[2] = demoShortcut(2, ShortcutType.MACRO, 0);
  slots[3] = demoShortcut(3, ShortcutType.ITEM, objectIdForItem(727)); // Healing Potion (item-misc)
  slots[4] = demoShortcut(4, ShortcutType.ITEM, objectIdForItem(2)); // Long Sword (item-weapon)
  slots[5] = demoShortcut(5, ShortcutType.ITEM, objectIdForItem(44)); // Leather Helmet (item-armor)
  slots[6] = demoShortcut(6, ShortcutType.ITEM, objectIdForItem(875)); // Ring of Knowledge (item-jewelry)
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
    hp: creature.Hp,
    maxHp: creature.MaxHp,
    isDead: creature.IsDead,
    buffs: Array.from(creature.Buffs),
  };

  if (creature instanceof L2Character) {
    const pledge = creature.ClanId ? pledgeCache.get(creature.ClanId) : undefined;
    return {
      ...base,
      // Players always have a real name from CharSelected/CharSelectionInfo/
      // PartySmallWindow -- no fallback needed here.
      name: creature.Name,
      title: creature.Title || undefined,
      clanName: pledge?.ClanName,
      allyName: pledge?.AllyName,
      clanCrestId: creature.ClanCrestId,
      allyCrestId: creature.AllyCrestId,
      recommHave: creature.RecommHave,
    };
  }

  const isAttackable = creature instanceof L2Mob;
  return {
    ...base,
    // NpcInfo's own wire name can come back empty for templates that expect
    // the client to resolve it locally (see NpcInfo.ts's comment) -- fall
    // back to the id->name table for those.
    name: creature.Name || getNpcName(creature.Id, isAttackable),
    creatureKind: isAttackable ? "mob" : creature instanceof L2Summon ? "summon" : "npc",
    race: getNpcRace(creature.Id),
    level: getNpcLevel(creature.Id),
  };
}

/** Same name-resolution rule as targetSnapshotFromCreature, but for the world scene's WorldCreatureSnapshot (position, not stats). */
function worldCreatureSnapshotFromCreature(creature: L2Creature): WorldCreatureSnapshot {
  const isAttackable = creature instanceof L2Mob;
  const kind: WorldCreatureSnapshot["kind"] = creature instanceof L2Character
    ? "player"
    : isAttackable
      ? "mob"
      : creature instanceof L2Summon
        ? "summon"
        : "npc";

  return {
    objectId: creature.ObjectId,
    name: creature instanceof L2Character ? creature.Name : creature.Name || getNpcName(creature.Id, isAttackable),
    x: creature.X,
    y: creature.Y,
    z: creature.Z,
    heading: creature.Heading,
    kind,
    isDead: creature.IsDead,
  };
}

export interface SystemMessageEntry {
  id: number;
  text: string;
}

let nextSystemMessageEntryId = 1;
const SYSTEM_MESSAGES_MAX_ENTRIES = 200;

export interface ChatMessage {
  id: number;
  channel: number;
  senderName: string;
  text: string;
}

let nextChatMessageId = 1;
const CHAT_MAX_ENTRIES = 200;

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
  /** ObjectId -> nearby creature, see bindToClient's syncCreatures. */
  creatures: Map<number, WorldCreatureSnapshot> = new Map();
  /** Own character's live position, see bindToClient's syncCreatures. */
  myPosition: MyPositionSnapshot | undefined = undefined;
  /** ObjectId of the character entered world with, once Start actually succeeds. */
  me: number | undefined = undefined;
  /** ObjectId of the character highlighted on the char-select screen. */
  selectedCharacterId: number | undefined = undefined;
  inventoryItems: L2Item[] = createDemoInventory();
  hotbarSlots: (L2Shortcut | undefined)[] = createDemoHotbarShortcuts(this.inventoryItems);
  skills: L2Skill[] = createDemoSkills();
  buffs: L2Buff[] = createDemoBuffs();
  /** Healing-potion reuse-cooldown icon, see ShortBuffStatusUpdate.ts -- a single value, not part of buffs (own row in effects.window.tsx). No demo data: no verified real skill id to fake it with. */
  shortBuff: L2Buff | undefined = undefined;
  /** Action ids the server currently allows (ExBasicActionList) -- undefined until the first one arrives, which isBasicActionAllowed() treats as "no restriction known" rather than "nothing allowed" (keeps the Actions window fully enabled offline/in demo mode). */
  basicActionIds: Set<number> | undefined = undefined;
  charInfo: CharInfoSnapshot = createDemoCharInfo();
  party: L2PartyMember[] = createDemoParty();
  /** Currently selected attack/spell/buff target, if any -- see target-select window. */
  target: TargetSnapshot | undefined = undefined;
  /** True while the local player is dead, see the Die/Revive event handlers in bindToClient -- drives the death modal. */
  isPlayerDead: boolean = false;
  /** True once the game connection has dropped (graceful ServerClose or an abrupt socket loss), see bindToClient -- drives the disconnect modal. Cleared on the next successful world-enter. */
  isDisconnected: boolean = false;
  /** Pending "so-and-so wants to resurrect you" prompt (a ConfirmDlg with isResurrect=true), pre-formatted the same way recordSystemMessage formats its entries -- drives the "resurrect" window. expiresAt is only set for the Charm of Courage self-res case (the only one the real server sends a timeout for, see Player.reviveRequest -- a normal party/priest request waits indefinitely). Cleared on accept/decline, a successful Revive, or the next world-enter. */
  resurrectRequest: { requesterId: number; message: string; expiresAt: number | undefined } | undefined = undefined;
  /** Pending party invite (AskJoinParty -> "PartyRequest") -- drives the "party-invite" window. Cleared on accept/decline or the next world-enter. */
  partyInviteRequest: { requestorName: string; distributionType: PartyDistributionType } | undefined = undefined;
  /** Pending trade request (SendTradeRequest -> "TradeRequest") -- drives the "trade-request" window. This client has no trade session UI yet, so accepting only sends the answer; the server's follow-up TradeStart isn't consumed. Cleared on accept/decline or the next world-enter. */
  tradeRequest: { requesterId: number; requesterName: string } | undefined = undefined;
  /** Pending duel request (ExDuelAskStart -> "RequestedDuel") -- drives the "duel-request" window. This client has no duel-in-progress UI yet, so accepting only sends the answer. expiresAt is a client-side-only countdown (see DUEL_REQUEST_TIMEOUT_MS's comment) -- unlike resurrect, ExDuelAskStart carries no time field on the wire. Cleared on accept/decline, expiry, or the next world-enter. */
  duelRequest: { requestorName: string; partyDuel: boolean; expiresAt: number } | undefined = undefined;
  /** clanId -> resolved name, filled in as PledgeInfo packets arrive. See targetSnapshotFromCreature. */
  pledgeCache: Map<number, PledgeSnapshot> = createDemoPledgeCache();
  /** System-message feed (combat text plus everything not filtered by isNoisySystemMessage()), see system-messages window. Starts empty -- populated from real SystemMessage packets, no demo placeholder (unlike most of this store). */
  systemMessages: SystemMessageEntry[] = [];
  /** Chat log feed, see chat window and recordChatMessage/sendChatMessage. Starts empty -- populated from real CreatureSay packets, no demo placeholder. */
  chatMessages: ChatMessage[] = [];
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

  /** Only "Town" is offered -- clan hall/castle/fixed points require ownership data this client doesn't model yet. */
  reviveAtTown() {
    if (this.client?.GameClient.IsConnected) {
      this.client.revive(RestartPoint.TOWN);
    } else {
      this.isPlayerDead = false;
    }
  }

  acceptResurrect() {
    this.client?.acceptResurrect();
    this.resurrectRequest = undefined;
  }

  declineResurrect() {
    this.client?.declineResurrect();
    this.resurrectRequest = undefined;
  }

  acceptPartyInvite() {
    this.client?.acceptJoinParty();
    this.partyInviteRequest = undefined;
  }

  declinePartyInvite() {
    this.client?.declineJoinParty();
    this.partyInviteRequest = undefined;
  }

  acceptTradeRequest() {
    this.client?.acceptTradeRequest();
    this.tradeRequest = undefined;
  }

  declineTradeRequest() {
    this.client?.declineTradeRequest();
    this.tradeRequest = undefined;
  }

  acceptDuel() {
    this.client?.acceptDuel();
    this.duelRequest = undefined;
  }

  declineDuel() {
    this.client?.declineDuel();
    this.duelRequest = undefined;
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

  /** Attacks the current target (AttackRequest). */
  attack() {
    const target = this.target;
    if (!target) {
      return;
    }
    this.client?.attack(target.objectId);
  }

  /** Assists the current target -- only valid when it's a party member (RequestActionUse ASSIST; the server infers "assist whoever my target is attacking" from the already-synced target selection, no objectId needed on the wire). */
  assist() {
    const target = this.target;
    if (!target || !this.party.some((member) => member.ObjectId === target.objectId)) {
      return;
    }
    this.client?.action("ASSIST");
  }

  /** Invites the current target to a party (RequestJoinParty) -- only valid for a player target not already in the party. */
  inviteToParty() {
    const target = this.target;
    if (!target || target.creatureKind || this.party.some((member) => member.ObjectId === target.objectId)) {
      return;
    }
    this.client?.requestJoinParty(target.name);
  }

  /** Challenges the current target to a 1v1 duel (RequestDuelStart) -- only valid for a player target. */
  challengeToDuel() {
    const target = this.target;
    if (!target || target.creatureKind) {
      return;
    }
    this.client?.requestDuel(target.name);
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

  /** True if the server hasn't told us otherwise yet (see basicActionIds' field comment) or explicitly allows this action id right now (ExBasicActionList -- the full set normally, a restricted set while transformed). */
  isBasicActionAllowed(code: Actions): boolean {
    return !this.basicActionIds || this.basicActionIds.has(code);
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

  private recordSystemMessage(messageId: number, params: unknown[], paramTypes: number[]) {
    if (isNoisySystemMessage(messageId)) {
      return;
    }
    const text = formatSystemMessage(messageId, params, paramTypes);
    this.systemMessages = [...this.systemMessages, { id: nextSystemMessageEntryId++, text }].slice(
      -SYSTEM_MESSAGES_MAX_ENTRIES
    );
  }

  private recordChatMessage(channel: number, senderName: string, text: string) {
    this.chatMessages = [...this.chatMessages, { id: nextChatMessageId++, channel, senderName, text }].slice(
      -CHAT_MAX_ENTRIES
    );
  }

  /**
   * Sends a chat message on the given channel. When connected, dispatches
   * the matching ClientCommands say/shout/tell/... call and relies on the
   * server echoing the message back via its own CreatureSay (real L2 always
   * includes the sender in a channel's broadcast, including the "->target"
   * echo TypeTell.ts sends for whispers) -- no local echo needed. Offline/
   * demo mode has no server to echo from, so it appends locally instead,
   * same dual-path treatment as the rest of this store.
   */
  sendChatMessage(text: string, channel: number, target?: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    if (this.client?.GameClient.IsConnected) {
      switch (channel) {
        case ChatType.SHOUT:
          this.client.shout(trimmed);
          break;
        case ChatType.WHISPER:
          if (target) {
            this.client.tell(trimmed, target);
          }
          break;
        case ChatType.PARTY:
          this.client.sayToParty(trimmed);
          break;
        case ChatType.CLAN:
          this.client.sayToClan(trimmed);
          break;
        case ChatType.TRADE:
          this.client.sayToTrade(trimmed);
          break;
        case ChatType.ALLIANCE:
          this.client.sayToAlly(trimmed);
          break;
        case ChatType.HERO_VOICE:
          this.client.sayToHero(trimmed);
          break;
        case ChatType.GENERAL:
        default:
          this.client.say(trimmed);
          break;
      }
      return;
    }

    const senderName = this.charInfo.name || "You";
    if (channel === ChatType.WHISPER && target) {
      this.recordChatMessage(channel, `->${target}`, trimmed);
      return;
    }
    this.recordChatMessage(channel, senderName, trimmed);
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
    const syncShortBuff = () => runInAction(() => {
      this.shortBuff = client.ShortBuff;
    });
    const syncBasicActions = () => runInAction(() => {
      this.basicActionIds = client.BasicActionIds;
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
    // World-scene creatures (NPCs/mobs/other players) + our own live
    // position, for the 3D scene -- separate from the target-select
    // window's TargetSnapshot (stats-focused, one creature at a time).
    // client.CreaturesList is kept consistent by the network layer's own
    // mutators (NpcInfoMutator/CharInfoMutator/DeleteObjectMutator/etc), so
    // re-reading it whole on each relevant packet is simpler and more
    // robust than tracking incremental add/remove/move ourselves.
    const syncCreatures = () => runInAction(() => {
      // Guards the 150ms poll below from doing pointless work (and touching
      // client.Me.ObjectId, which is a real but meaningless default L2User
      // instance -- see GameClient.ActiveChar) on the login/char-select
      // screens, before any game-server socket exists at all.
      if (!client.GameClient.IsConnected) {
        return;
      }

      const myObjectId = client.Me.ObjectId;
      const next = new Map<number, WorldCreatureSnapshot>();
      for (const creature of client.CreaturesList) {
        if (creature.ObjectId === myObjectId) {
          continue;
        }
        next.set(creature.ObjectId, worldCreatureSnapshotFromCreature(creature));
      }
      this.creatures = next;

      console.log("syncCreatures: myObjectId", myObjectId, "creatures", this.creatures.size);

      const me = client.Me;
      this.myPosition = { x: me.X, y: me.Y, z: me.Z, heading: me.Heading };
    });

    client.on("PacketReceived", "NpcInfo", syncCreatures);
    client.on("PacketReceived", "CharInfo", syncCreatures);
    client.on("PacketReceived", "DeleteObject", syncCreatures);
    client.on("PacketReceived", "UserInfo", syncCreatures);
    // Positions keep ticking internally between packets (L2Creature's own
    // setMovingTo 100ms interval, see the network package) -- poll so
    // rendered positions stay live while anything (including ourselves) is
    // walking, not just on spawn/despawn.
    setInterval(syncCreatures, 150);

    client.on("PacketReceived", "ItemList", syncInventory);
    client.on("PacketReceived", "InventoryUpdate", syncInventory);
    client.on("PacketReceived", "SkillList", syncSkills);
    client.on("PacketReceived", "SkillCoolTime", syncSkills);
    client.on("PacketReceived", "AbnormalStatusUpdate", syncBuffs);
    client.on("PacketReceived", "ShortBuffStatusUpdate", syncShortBuff);
    client.on("PacketReceived", "ExBasicActionList", syncBasicActions);
    client.on("PacketReceived", "ShortCutInit", syncHotbar);
    client.on("PacketReceived", "ShortCutRegister", syncHotbar);
    client.on("PacketReceived", "ShortCutDelete", syncHotbar);
    client.on("PacketReceived", "CharSelected", syncCharInfo);
    client.on("PacketReceived", "UserInfo", syncCharInfo);
    // UserInfo is the "definitely (re)entered the world" signal syncCharInfo
    // also keys off -- clears any isDisconnected left over from an earlier
    // dropped connection attempt, so a fresh successful session doesn't open
    // straight into the disconnect modal.
    client.on("PacketReceived", "UserInfo", () => runInAction(() => {
      this.isDisconnected = false;
      this.resurrectRequest = undefined;
      this.partyInviteRequest = undefined;
      this.tradeRequest = undefined;
      this.duelRequest = undefined;
    }));
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
      runInAction(() => this.recordSystemMessage(e.data.messageId, e.data.params, e.data.paramTypes));
    });

    client.on("CreatureSay", (e: ECreatureSay) => {
      const text = e.data.messages.join(" ");
      runInAction(() => this.recordChatMessage(e.data.type, e.data.charName, text));
    });

    // Drives the death modal -- only reacts when the affected creature is
    // the local player, same ObjectId comparison syncCreatures uses.
    client.on("Die", (e: EDie) => runInAction(() => {
      if (e.data.creature.ObjectId === client.Me.ObjectId) {
        this.isPlayerDead = true;
      }
    }));
    client.on("Revive", (e: ERevive) => runInAction(() => {
      if (e.data.creature.ObjectId === client.Me.ObjectId) {
        this.isPlayerDead = false;
        this.resurrectRequest = undefined;
      }
    }));

    // Drives the "resurrect" window -- a party member/priest/Charm of
    // Courage offering to bring the local player back. ConfirmDlgType's
    // resurrect ids double as real SystemMessageId values (see
    // ConfirmDlgMutator), so the prompt text reuses formatSystemMessage the
    // same way recordSystemMessage does.
    client.on("ConfirmDlg", (e: EConfirmDlg) => runInAction(() => {
      if (!e.data.isResurrect) {
        return;
      }
      this.resurrectRequest = {
        requesterId: e.data.requesterId,
        message: formatSystemMessage(e.data.messageId, e.data.params, e.data.paramTypes),
        expiresAt: e.data.time > 0 ? Date.now() + e.data.time : undefined,
      };
    }));

    // Drives the "party-invite" window.
    client.on("PartyRequest", (e: EPartyRequest) => runInAction(() => {
      this.partyInviteRequest = {
        requestorName: e.data.requestorName,
        distributionType: e.data.partyDistributionType,
      };
    }));

    // Drives the "trade-request" window. Accepting only sends the answer --
    // this client has no trade session UI yet, so the server's follow-up
    // TradeStart (the actual item-exchange window) goes unconsumed.
    client.on("TradeRequest", (e: ETradeRequest) => runInAction(() => {
      this.tradeRequest = {
        requesterId: e.data.requesterId,
        requesterName: e.data.requesterName,
      };
    }));

    // Drives the "duel-request" window. Accepting only sends the answer --
    // this client has no duel-in-progress UI yet.
    client.on("RequestedDuel", (e: ERequestedDuel) => runInAction(() => {
      this.duelRequest = {
        requestorName: e.data.requestorName,
        partyDuel: e.data.partyDuel,
        expiresAt: Date.now() + DUEL_REQUEST_TIMEOUT_MS,
      };
    }));

    // Drives the disconnect modal. ServerClose is the server's graceful
    // notice (kick, restart, ...) and normally fires moments before the
    // socket actually closes; the low-level "Disconnected" event (raw
    // EventEmitter, not the strictly-typed EventHandlerType union the rest
    // of this file uses -- see CommandLogin/CommandSelectServer for the
    // same pattern) is the fallback for an abrupt drop with no ServerClose
    // at all (network loss, crash).
    client.on("ServerClose", () => runInAction(() => {
      this.isDisconnected = true;
    }));
    client.GameClient.on("Disconnected", () => runInAction(() => {
      this.isDisconnected = true;
    }));

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
