import { makeAutoObservable, runInAction } from "mobx";
import {
  GameServerPacket,
  L2Item,
  L2Skill,
  L2Buff,
  L2Shortcut,
  L2PartyMember,
  L2Character,
  L2Creature,
  L2Mob,
  L2Summon,
  type L2DroppedItem,
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
  type L2User,
  type EGetItem,
  type EMagicSkillUse,
  type EMagicSkillLaunched,
  type EChangeWaitType,
  type EAttacked,
  type ESystemMessage,
  type ECreatureSay,
  type EDie,
  type ERevive,
  type EConfirmDlg,
  type EPartyRequest,
  type ETradeRequest,
  type ERequestedDuel,
  type EPairActionRequest,
  type ENpcHtmlMessage,
} from "@lineage2js/network";
import { IS_DEMO_MODE } from "../config/env";
import { getNpcRace, type NpcRace } from "../config/npc-race-mapping";
import { getClassLabel } from "../config/class-tree";
import { getNpcLevel } from "../config/npc-level-mapping";
import { getWeaponClass, type WeaponClass } from "../config/weapon-class-mapping";
import { getNpcName, tryGetNpcName } from "../config/npc-name-mapping";
import {
  CANNOT_MOVE_WHILE_SITTING_MESSAGE_ID,
  formatSystemMessage,
  isNoisySystemMessage,
} from "../config/system-message-mapping";
import { toLocalBaseClass, toLocalRace, toLocalSex } from "../config/network-mapping";
import { canMoveStraight } from "../utils/geodata/geo-path";
import { loadedGeoTiles } from "../utils/geodata/geo-tile-index";
import { interpolatedCreaturePosition, isStillMoving, type CreatureMoveState } from "../utils/creature-movement";
import type { BaseClass, SexNames } from "../config/character-races";

/**
 * Any nearby creature (NPC/mob/player, including the local player -- see
 * syncCreatures) reported by NpcInfo/CharInfo/UserInfo, for the world scene
 * (not the target-select window -- see TargetSnapshot for that). Find your
 * own entry via GameStore.me as the key into GameStore.creatures, rather
 * than a separate self-only field -- self isn't a special case here.
 */
export interface WorldCreatureSnapshot {
  objectId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  kind: "player" | "mob" | "summon" | "npc";
  isDead: boolean;
  /** Seated (ChangeWaitType) -- can't move, and the body plays the sitting pose. */
  isSitting: boolean;
  /**
   * Mid pick-up, for the length of the animation. Unlike everything else
   * here this isn't a state the server tracks -- GetItem is a one-off "X
   * picked up Y" broadcast, so the window is the client's own (see
   * GameStore.notePickup).
   */
  isPickingUp: boolean;
  /**
   * Mid cast, for as long as the server said the cast takes -- MagicSkillUse
   * carries that duration, so unlike isPickingUp above this window isn't the
   * client's guess (see GameStore.noteCast).
   */
  isCasting: boolean;
  /**
   * Getting back up off the ground, for the length of that motion. Another
   * client-side window (see GameStore.noteStandUp): ChangeWaitType announces
   * the standing flag the moment it flips, and says nothing about the couple
   * of seconds the server then spends refusing to move.
   */
  isStandingUp: boolean;
  /** Mid swing, for the length of the attack clip -- see GameStore.noteAttack. */
  isAttacking: boolean;
  /**
   * What the creature is holding, resolved from its right-hand paperdoll
   * item, so the swing matches the weapon instead of always throwing a
   * punch. Every creature kind has it: NpcInfo fills that same slot for
   * mobs and NPCs.
   */
  weaponClass: WeaponClass;
  /**
   * Date.now() of the latest of the gestures above, so a repeat can be told
   * from a continuation. The flags alone can't: a creature trading blows is
   * isAttacking the whole time, and the body would swing once and then keep
   * hitting from a standstill (see GameStore.gestureStartedAt).
   */
  gestureStartedAt?: number;
  /**
   * Walking vs running (CharInfo/NpcInfo/UserInfo, kept current by
   * ChangeMoveType), which is also what L2Creature.CurrentSpeed picks its
   * speed off -- so it decides both how fast the move segment below advances
   * and which locomotion cycle the body plays.
   */
  isRunning: boolean;
  // RaceNames, for every creature kind -- RaceNames's 6 player-race values are a
  // literal subset of NpcRace's 23 (verified: identical spelling for every
  // shared key), so one field covers both instead of two parallel
  // player-only/non-player-only fields. Players: real value via
  // toLocalRace(). Non-players: resolved from the npc template id (see
  // config/npc-race-mapping.ts), only known for ids present in the
  // datapack-derived table (mostly Monster-type npcs; Folk/quest-givers
  // usually have none).
  race?: NpcRace;
  // Player-specific (kind === "player") -- lets CreatureModel pick the
  // right visual via getPlayerVisualFromVariant, same as char-select/char-create.
  baseClass?: BaseClass;
  sex?: SexNames;
  // Current move segment, for per-frame client-side interpolation (see
  // GameCreaturesField) instead of snapping to wherever this snapshot's
  // x/y/z happened to land on the last 150ms poll (see
  // L2Creature.setMovingTo's own field comment for why -- this class's x/y/z
  // already move in coarse ~100ms steps, too sparse to look smooth at
  // 60fps). undefined fields below mean "not currently moving" -- render
  // x/y/z as-is in that case, they're already the resting position.
  isMoving: boolean;
  moveFrom?: { x: number; y: number; z: number };
  moveTo?: { x: number; y: number; z: number };
  /** Date.now() epoch ms when the current move segment started. */
  moveStartedAt?: number;
  /** World units/second, for interpolating along moveFrom -> moveTo. */
  speed?: number;
}

export const MAX_CHARACTERS = 7;

const HOTBAR_SLOT_COUNT = 48; // 4 rows x 12 columns, matches the wire's slot + page*12 addressing

// Rough melee-range constant -- no per-weapon attack-range stat is parsed
// client-side yet (same gap as the rest of equipped-weapon data, see
// TODO.md's "Equipped armor/weapon visuals"), so this stands in for real
// melee reach (collision radii + a small buffer) until that exists. Ranged
// weapons (bow/etc, real range ~500-900) aren't accounted for.
const MELEE_ATTACK_RANGE = 40;
// How often to run a NetPing round trip while in the world. Far below the
// reference server's rate limit on the packet (2/sec) -- this only feeds a
// latency readout, there's nothing to gain from asking more often.
const NET_PING_INTERVAL_MS = 10_000;
// Typical retail NPC talk radius -- no per-npc interactionDistance stat is
// parsed client-side either, same gap as MELEE_ATTACK_RANGE above.
const NPC_INTERACT_RANGE = 150;

/**
 * A single queued "walk into range, then do X" intent (see
 * queueActionInRange) -- the client-side equivalent of what the real L2
 * client does when you click Attack (or interact/pick up) on something out
 * of reach: it doesn't reject the action, it walks you there first. Only
 * one at a time; queuing a new one (or picking a new target -- see
 * clearTarget/selectTarget/selectSelfAsTarget/selectCreatureAsTarget)
 * replaces/cancels whatever was pending.
 */
interface PendingAction {
  targetId: number;
  range: number;
  onArrive: () => void;
}

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
  /** L2Character.PledgeClass -- the char window's "Status" row, see config/pledge-class-mapping.ts. Not the same thing as title. */
  pledgeClass: number;
  className: string;
  /** 0 when clanless -- resolve the name via GameStore.pledgeCache, same as targetSnapshotFromCreature. */
  clanId: number;
  /** Progress through the current level, 0-100 -- already scaled up from L2User.ExpFraction's 0..1 wire value. */
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
    pledgeClass: 3, // Knight -- flavor value for a mid-level clan member, see charInfo.pledgeClass
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

// Neutral starting point outside demo mode (see IS_DEMO_MODE) -- zeroed
// rather than createDemoCharInfo()'s fake numbers, so a real session's
// UserInfo/StatusUpdate fills every field in from a clean slate instead of
// papering over a fake one. mAccuracy/mEvasion/mCritical are left unset,
// same as a real sync (see this interface's own field comment).
function createEmptyCharInfo(): CharInfoSnapshot {
  return {
    name: "",
    level: 1,
    cp: 0,
    maxCp: 0,
    hp: 0,
    maxHp: 0,
    mp: 0,
    maxMp: 0,
    vitalityPercent: 0,
    sp: 0,
    recommLeft: 0,
    title: "",
    pledgeClass: 0,
    className: "",
    clanId: 0,
    expPercent: 0,
    load: 0,
    maxLoad: 0,
    recommHave: 0,
    fame: 0,
    karma: 0,
    pvpKills: 0,
    pkKills: 0,
    pAtk: 0,
    pDef: 0,
    accuracy: 0,
    evasion: 0,
    critical: 0,
    atkSpd: 0,
    speed: 0,
    mAtk: 0,
    mDef: 0,
    castingSpd: 0,
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wit: 0,
    men: 0,
    hennaStr: 0,
    hennaDex: 0,
    hennaCon: 0,
    hennaInt: 0,
    hennaWit: 0,
    hennaMen: 0,
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
  equipped?: boolean;
}

// Builds a real L2Item, same shape a server ItemList/InventoryUpdate packet
// would produce -- only ObjectId/ItemId/Type2/BodyPart/Count/IsQuest/Grade/
// IsEquipped are set, everything else stays at its default like an unread
// wire field would. No Name: that's resolved from the item-name table via
// t("item.name.<id>"), same as it would be for real server data (see
// config/item-mapping.ts).
function demoItem({ id, type2, bodyPart, count, grade, equipped }: DemoItemInit): L2Item {
  const item = new L2Item();
  item.ObjectId = nextObjectId++;
  item.Id = id;
  item.Type2 = type2;
  item.BodyPart = bodyPart ?? L2Item.SLOT_NONE;
  item.Count = count ?? 1;
  item.IsQuest = type2 === ItemType2.QuestItem;
  item.Grade = grade ?? ItemGrade.None;
  item.IsEquipped = equipped ?? false;
  return item;
}

// Real item ids (see the item-name table this pairs with), picked to cover
// one example of every inventory tab/slot type. The bodyPart-bearing items
// start equipped so the paperdoll has something to render out of the box.
function createDemoInventory(): L2Item[] {
  return [
    demoItem({ id: 727, type2: ItemType2.Item, count: 25 }), // Healing Potion
    demoItem({ id: 728, type2: ItemType2.Item, count: 10 }), // Mana Potion
    demoItem({ id: 1869, type2: ItemType2.Item, count: 47 }), // Iron Ore
    demoItem({ id: 702, type2: ItemType2.Item, count: 132 }), // Wolf Pelt
    demoItem({ id: 987, type2: ItemType2.QuestItem, count: 1 }), // Ancient Clay Tablet
    demoItem({ id: 57, type2: ItemType2.Adena, count: 15230 }), // Adena
    demoItem({ id: 44, type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_HEAD, grade: ItemGrade.D, equipped: true }), // Leather Helmet
    demoItem({ id: 33, type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_LEGS, grade: ItemGrade.D, equipped: true }), // Hard Leather Gaiters
    demoItem({ id: 40, type2: ItemType2.ShieldArmor, bodyPart: L2Item.SLOT_FEET, grade: ItemGrade.D, equipped: true }), // Leather Boots
    demoItem({ id: 2, type2: ItemType2.Weapon, bodyPart: L2Item.SLOT_R_HAND, grade: ItemGrade.D, equipped: true }), // Long Sword
    // Rings/earrings only ever carry the shared dual-slot bitmask on the wire
    // (real HighFive item data has no single-side R_FINGER/R_EAR template --
    // see paperdoll-mapping.ts), so the demo data uses SLOT_LR_FINGER/LR_EAR too.
    demoItem({ id: 875, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_LR_FINGER, equipped: true }), // Ring of Knowledge
    demoItem({ id: 906, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_NECK, equipped: true }), // Necklace of Knowledge
    demoItem({ id: 115, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_LR_EAR, equipped: true }), // Earring of Wisdom
    demoItem({ id: 9589, type2: ItemType2.RingEarringNecklace, bodyPart: L2Item.SLOT_R_BRACELET, equipped: true }), // Iron Bracelet
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
  // Falls back to creatureKind's icon when this is undefined. Named to match
  // WorldCreatureSnapshot.race.
  npcRace?: NpcRace;
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
    npcRace: getNpcRace(creature.Id),
    level: getNpcLevel(creature.Id),
  };
}

/** Similar to targetSnapshotFromCreature, but for the world scene's WorldCreatureSnapshot (position, not stats) -- name resolution differs, see the `name` field's own comment below. */
/**
 * The client-side gesture windows a snapshot carries, none of which the
 * server keeps a flag for -- each is a listener's own timer over a one-off
 * broadcast (GetItem, MagicSkillUse, ChangeWaitType, Attack).
 */
interface CreatureGestures {
  isPickingUp: boolean;
  isCasting: boolean;
  isStandingUp: boolean;
  isAttacking: boolean;
  gestureStartedAt?: number;
}

function worldCreatureSnapshotFromCreature(
  creature: L2Creature,
  gestures: CreatureGestures
): WorldCreatureSnapshot {
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
    ...creatureMoveState(creature),
    // No "Mob #<id>"/"NPC #<id>" placeholder here (unlike targetSnapshotFromCreature)
    // -- an unnamed npc just gets no floating nameplate in the world scene at
    // all, rather than a raw id (see tryGetNpcName's comment). It still shows
    // that placeholder in the target-select window once actually targeted.
    name: creature instanceof L2Character ? creature.Name : creature.Name || tryGetNpcName(creature.Id) || "",
    heading: creature.Heading,
    kind,
    isDead: creature.IsDead,
    isSitting: creature.IsSitting,
    isRunning: creature.IsRunning,
    ...gestures,
    weaponClass: getWeaponClass(creature.Paperdoll[GameServerPacket.PAPERDOLL_RHAND]),
    race: kind === "player" ? toLocalRace(creature) : getNpcRace(creature.Id),
    baseClass: kind === "player" ? toLocalBaseClass(creature) : undefined,
    sex: kind === "player" ? toLocalSex(creature) : undefined,
  };
}

/**
 * The move-segment view of a live creature (see CreatureMoveState) -- the
 * exact input both the world scene's rendering and the local player's
 * position heartbeat interpolate from, so the two can't drift apart by
 * reading different fields.
 */
function creatureMoveState(creature: L2Creature): CreatureMoveState {
  const isMoving = creature.IsMoving && creature.MoveStartedAt !== undefined;
  const state: CreatureMoveState = {
    x: creature.X,
    y: creature.Y,
    z: creature.Z,
    isMoving,
    moveFrom: isMoving ? { x: creature.MoveFromX!, y: creature.MoveFromY!, z: creature.MoveFromZ! } : undefined,
    moveTo: isMoving ? { x: creature.Dx, y: creature.Dy, z: creature.Dz } : undefined,
    moveStartedAt: isMoving ? creature.MoveStartedAt : undefined,
    speed: isMoving ? creature.CurrentSpeed : undefined,
  };
  // The flag on its own says a move was started, not that it is still
  // running -- see isStillMoving. The segment is kept either way, since the
  // position math clamps to its end and that end is where the creature is.
  return { ...state, isMoving: isStillMoving(state) };
}

/**
 * A nearby ground item (SpawnItem/DropItem), for the 3D scene -- see
 * GameStore.droppedItems/bindToClient's syncDroppedItems. Unlike creatures,
 * items never move once spawned, so no moveFrom/moveTo/interpolation fields.
 */
export interface WorldItemSnapshot {
  objectId: number;
  itemId: number;
  count: number;
  x: number;
  y: number;
  z: number;
}

function worldItemSnapshotFromItem(item: L2DroppedItem): WorldItemSnapshot {
  return {
    objectId: item.ObjectId,
    itemId: item.Id,
    count: item.Count,
    x: item.X,
    y: item.Y,
    z: item.Z,
  };
}

export interface SystemMessageEntry {
  id: number;
  text: string;
}

let nextSystemMessageEntryId = 1;
/**
 * How long a creature keeps playing the pick-up animation. Longer than the
 * clip on purpose -- see notePickup.
 */
const PICKUP_ANIMATION_MS = 1200;

/**
 * How long a creature keeps playing the stand-up motion. Sized to outlast
 * the longest of the ten rigs' Stand sequences (FFighter/FElf at 3.4s, see
 * the assets server's AUTHORED_SECONDS) for the same reason as
 * PICKUP_ANIMATION_MS: overshooting costs nothing once the clip has settled
 * back into idle, while cutting it short is visible.
 *
 * Not a movement gate. The server holds the character seated for its own
 * stand-up delay (2.5s in the reference server) and refuses orders until
 * then -- which is what makes the motion worth drawing at all -- but that
 * number is the server's to enforce, and this client doesn't try to
 * second-guess it.
 */
const STAND_UP_ANIMATION_MS = 3500;

/**
 * How long a creature keeps swinging after an Attack broadcast. The attack
 * clips run 1.43-1.53s across the rigs, so this just outlasts the longest.
 *
 * Retail scales the swing to the attacker's attack speed; the wire carries
 * no duration here (unlike a cast's HitTime) and PAtkSpd is only known for
 * the local player, so every attacker swings at the clip's own pace for now.
 */
const ATTACK_ANIMATION_MS = 1600;

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
  /** ObjectId -> nearby creature (includes the local player -- look it up via `me`, see bindToClient's syncCreatures). */
  creatures: Map<number, WorldCreatureSnapshot> = new Map();
  /** ObjectId -> nearby ground item, for the 3D scene -- see bindToClient's syncDroppedItems. */
  droppedItems: Map<number, WorldItemSnapshot> = new Map();
  /** ObjectId of the character entered world with, once Start actually succeeds. */
  me: number | undefined = undefined;
  /** ObjectId of the character highlighted on the char-select screen. */
  selectedCharacterId: number | undefined = undefined;
  inventoryItems: L2Item[] = IS_DEMO_MODE ? createDemoInventory() : [];
  hotbarSlots: (L2Shortcut | undefined)[] = IS_DEMO_MODE
    ? createDemoHotbarShortcuts(this.inventoryItems)
    : new Array(HOTBAR_SLOT_COUNT).fill(undefined);
  skills: L2Skill[] = IS_DEMO_MODE ? createDemoSkills() : [];
  buffs: L2Buff[] = IS_DEMO_MODE ? createDemoBuffs() : [];
  /** Healing-potion reuse-cooldown icon, see ShortBuffStatusUpdate.ts -- a single value, not part of buffs (own row in effects.window.tsx). No demo data: no verified real skill id to fake it with. */
  shortBuff: L2Buff | undefined = undefined;
  /** Action ids the server currently allows (ExBasicActionList) -- undefined until the first one arrives, which isBasicActionAllowed() treats as "no restriction known" rather than "nothing allowed" (keeps the Actions window fully enabled offline/in demo mode). */
  basicActionIds: Set<number> | undefined = undefined;
  /** Item ids currently toggled into auto-use (RequestAutoSoulShot) -- see toggleAutoShot, hotbar's RMB handler for shot slots. Purely local UI state, mirroring what the real client tracks for the same feature (the server has no "list my auto shots" query). */
  autoShotItemIds = new Set<number>();
  charInfo: CharInfoSnapshot = IS_DEMO_MODE ? createDemoCharInfo() : createEmptyCharInfo();
  party: L2PartyMember[] = IS_DEMO_MODE ? createDemoParty() : [];
  /** Currently selected attack/spell/buff target, if any -- see target-select window. */
  target: TargetSnapshot | undefined = undefined;
  /** Queued "walk into range, then do X" intent, see PendingAction/queueActionInRange. */
  pendingAction: PendingAction | undefined = undefined;
  /** setupMoveHeartbeat's own bookkeeping, not observable/UI state -- see that method. */
  moveHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  /** Round trip of the last NetPing exchange, in ms -- see setupNetPing. undefined until the first reply lands. */
  latencyMs: number | undefined = undefined;
  /** True once an outstanding RequestNetPing has gone unanswered for a full NET_PING_INTERVAL_MS -- see setupNetPing's ping(). Cleared the moment a reply lands. */
  netPingTimedOut: boolean = false;
  /** Server-reported online time from the latest NetPing reply. Unit unconfirmed -- see the network package's incoming/game/NetPing.ts. */
  onlineTime: number | undefined = undefined;
  netPingInterval: ReturnType<typeof setInterval> | null = null;
  /** Date.now() when the outstanding RequestNetPing went out, for measuring the round trip. */
  netPingSentAt: number | undefined = undefined;
  moveHeartbeatChar: L2User | undefined = undefined;
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
  /** Pending pair (couple) social-action request (ExAskCoupleAction -> "PairActionRequest", e.g. High Five/Exchange Bows/Couple Dance) -- drives the "pair-action-request" window. Cleared on accept/decline or the next world-enter. */
  pairActionRequest: { requesterName: string; actionId: number } | undefined = undefined;
  /** Current NPC dialogue (NpcHtmlMessage) -- drives the "npc-dialogue" window. A fresh message simply replaces whatever was showing (matches the real client: clicking a bypass link swaps the window's content in place, it doesn't open a second window). Cleared by closeNpcDialogue() or the next world-enter. */
  npcDialogue: { npcObjectId: number; html: string; itemId: number } | undefined = undefined;
  /** clanId -> resolved name, filled in as PledgeInfo packets arrive. See targetSnapshotFromCreature. */
  pledgeCache: Map<number, PledgeSnapshot> = IS_DEMO_MODE ? createDemoPledgeCache() : new Map();
  /** System-message feed (combat text plus everything not filtered by isNoisySystemMessage()), see system-messages window. Starts empty -- populated from real SystemMessage packets, no demo placeholder (unlike most of this store). */
  systemMessages: SystemMessageEntry[] = [];
  /** Chat log feed, see chat window and recordChatMessage/sendChatMessage. Starts empty -- populated from real CreatureSay packets, no demo placeholder. */
  chatMessages: ChatMessage[] = [];
  /** Skills-list "Learn" tab data, see LearnableSkillSnapshot. */
  learnableSkills: LearnableSkillSnapshot[] = IS_DEMO_MODE ? createDemoLearnableSkills() : [];
  /** Currently open in the "skill" detail window, if any. */
  selectedLearnableSkill: LearnableSkillSnapshot | undefined = undefined;
  /** Set once by bindToClient -- used by selectTarget/clearTarget to dispatch outgoing packets. */
  client: Client | undefined;
  /**
   * slot -> Date.now() when clearHotbarSlot last told the server to delete
   * it. Defends against a server that re-sends a full ShortCutInit snapshot
   * a moment after processing a delete, but before that delete has actually
   * persisted server-side -- observed in practice: the just-deleted slot
   * reappears in that stale snapshot a second or two later. syncHotbar
   * blanks any slot still listed here when a fresh ShortCutInit arrives,
   * for a short grace window (see HOTBAR_DELETE_GRACE_MS). Not observable --
   * pure bookkeeping, never read by a component.
   */
  pendingHotbarDeletes = new Map<number, number>();
  private static readonly HOTBAR_DELETE_GRACE_MS = 8000;

  /**
   * creature objectId -> Date.now() when its pick-up animation is over. Not
   * reactive: the GetItem handler re-syncs the creature snapshots itself, and
   * those are what the scene actually reads.
   */
  // Not private only so makeAutoObservable below can opt it out; nothing outside reads it.
  pickingUpUntil = new Map<number, number>();

  /**
   * creature objectId -> Date.now() when its cast is due to end. Same shape
   * as pickingUpUntil and non-reactive for the same reason, but the deadline
   * isn't invented here: MagicSkillUse carries the server's own cast time.
   */
  // Not private only so makeAutoObservable below can opt it out; nothing outside reads it.
  castingUntil = new Map<number, number>();

  /** creature objectId -> Date.now() when its stand-up motion is over. Same shape as pickingUpUntil. */
  // Not private only so makeAutoObservable below can opt it out; nothing outside reads it.
  standingUpUntil = new Map<number, number>();

  /** creature objectId -> Date.now() when its swing is over. Same shape as pickingUpUntil. */
  // Not private only so makeAutoObservable below can opt it out; nothing outside reads it.
  attackingUntil = new Map<number, number>();

  /**
   * creature objectId -> Date.now() of its latest one-shot gesture, whichever
   * it was. The windows above say *that* a creature is swinging or casting;
   * this says *when it last started*, which is the only thing that can tell
   * one blow from the next while the animation stays "attack" throughout --
   * without it a creature in a sustained fight swung once and then landed the
   * rest of its hits standing still.
   */
  // Not private only so makeAutoObservable below can opt it out; nothing outside reads it.
  gestureStartedAt = new Map<number, number>();

  constructor() {
    makeAutoObservable(this, {
      client: false,
      pendingHotbarDeletes: false,
      pickingUpUntil: false,
      castingUntil: false,
      standingUpUntil: false,
      attackingUntil: false,
      gestureStartedAt: false,
      moveHeartbeatInterval: false,
      moveHeartbeatChar: false,
      netPingInterval: false,
      netPingSentAt: false,
    });
  }

  selectCharacter(id: number | undefined) {
    this.selectedCharacterId = id;
  }

  /**
   * Places a shortcut in a hotbar slot -- used by the hotbar's drag-and-drop
   * (dragging an item/skill/action/macro/recipe from its source panel, or
   * moving/swapping an existing hotbar slot). `source` is only set for the
   * latter: when it names a *different* slot, whatever used to be in the
   * target slot (if anything) is moved back into the source slot instead of
   * being lost, i.e. a real swap rather than an overwrite.
   *
   * When connected, sends RequestShortCutReg (registerShortcut) and relies
   * on the server's echoed ShortCutRegister packet to actually update
   * hotbarSlots (see bindToClient's syncHotbar) -- same "no local echo,
   * server is authoritative" treatment as sendChatMessage. A displaced slot
   * from a hotbar-to-hotbar move gets its own registerShortcut call (moved
   * to the source slot); an empty source instead goes through
   * clearHotbarSlot, since a delete gets no server confirmation at all.
   * Offline/demo mode mutates hotbarSlots directly instead.
   */
  setHotbarSlot(slot: number, shortcut: L2Shortcut, source?: { from: "hotbar"; slot: number }) {
    const displaced = this.hotbarSlots[slot];
    shortcut.Slot = slot;

    if (this.client?.GameClient.IsConnected) {
      // This slot is being actively reasserted -- no longer needs
      // protecting from a stale ShortCutInit resurrecting an old delete.
      this.pendingHotbarDeletes.delete(slot);
      this.client.registerShortcut(shortcut);
      if (source?.from === "hotbar" && source.slot !== slot) {
        if (displaced) {
          displaced.Slot = source.slot;
          this.pendingHotbarDeletes.delete(source.slot);
          this.client.registerShortcut(displaced);
        } else {
          this.clearHotbarSlot(source.slot);
        }
      }
      return;
    }

    const next = [...this.hotbarSlots];
    next[slot] = shortcut;
    if (source?.from === "hotbar" && source.slot !== slot) {
      if (displaced) {
        displaced.Slot = source.slot;
      }
      next[source.slot] = displaced;
    }
    this.hotbarSlots = next;
  }

  /**
   * Clears a hotbar slot -- used when a shortcut is dragged off the hotbar
   * entirely (and internally by setHotbarSlot for a hotbar move with no
   * displaced slot to swap back). Sends RequestShortCutDel when connected,
   * but always also clears hotbarSlots directly: unlike registerShortcut,
   * the server sends no confirmation packet back for a delete (see
   * RequestShortcutDel.java upstream: "client needs no confirmation, this
   * packet is just to inform the server"), so there's no echo to wait on.
   */
  clearHotbarSlot(slot: number) {
    if (this.client?.GameClient.IsConnected) {
      this.client.deleteShortcut(slot);
      this.pendingHotbarDeletes.set(slot, Date.now());
    }
    const next = [...this.hotbarSlots];
    next[slot] = undefined;
    this.hotbarSlots = next;
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
    // No IsConnected check needed -- client.xxx() commands are already safe
    // to call while disconnected, see AbstractGameCommand.requiresGameConnection.
    this.client?.hit(member);
    this.target = targetSnapshotFromCreature(member, this.pledgeCache);
    this.pendingAction = undefined;
  }

  clearTarget() {
    this.client?.cancelTarget();
    this.target = undefined;
    this.pendingAction = undefined;
  }

  /**
   * Selects the local player as their own target -- same Action/hit packet
   * mechanism as selectTarget, just with client.Me as the object. Lets
   * clicking your own name/level in the character window put yourself in
   * the target-select window (e.g. to check your own buffs).
   */
  selectSelfAsTarget() {
    const me = this.client?.Me;
    if (!me) {
      return;
    }
    this.client?.hit(me);
    this.target = targetSnapshotFromCreature(me, this.pledgeCache);
    this.pendingAction = undefined;
  }

  /**
   * Selects any nearby creature (NPC/mob/other player) as the current
   * target by objectId -- same Action/hit packet mechanism as
   * selectTarget/selectSelfAsTarget, just looked up from CreaturesList since
   * the 3D scene's click handler (see CreatureModel's onSelect,
   * GameCreaturesField) only has a WorldCreatureSnapshot -- a plain data
   * snapshot -- rather than the live L2Creature reference those other two
   * already have on hand.
   */
  selectCreatureAsTarget(objectId: number) {
    const creature = this.client?.CreaturesList.getEntryByObjectId(objectId);
    if (!creature) {
      return;
    }
    // Same geodata gate as a move order: selecting something in the 3D scene
    // is the first half of "walk over and act on it" (see the click handling
    // in GameCreaturesField), so a creature the straight line can't reach --
    // across a canyon, on a bridge deck above us -- isn't selected at all
    // rather than selected and then never actually reached.
    if (!this.isStraightPathClear(creature.X, creature.Y, creature.Z, "target at")) {
      return;
    }
    this.client?.hit(objectId);
    this.target = targetSnapshotFromCreature(creature, this.pledgeCache);
    this.pendingAction = undefined;
  }

  /**
   * Sends a click-to-move request toward the given L2 world coordinates
   * (RequestMoveTo -- see CommandMoveTo/MoveBackwardToLocation). No local
   * prediction here: the server broadcasts movement back via MoveToLocation
   * for every nearby creature it knows about, including ourselves (same
   * mechanism GameCreaturesField already renders everyone else's movement
   * through, see GameStore.bindToClient's syncCreatures + interpolatedCreaturePosition),
   * so our own entry in `creatures` picks this up the same way once the
   * server's reply arrives -- no special-casing needed here.
   *
   * Withheld entirely when we're sitting (see refuseMoveWhileSitting) or when
   * geodata says the straight line there is blocked (see isStraightPathClear)
   * -- the server would only refuse it, or drag us along the wall, and either
   * way our own prediction inside CommandMoveTo would already have started
   * walking.
   */
  moveTo(x: number, y: number, z: number) {
    if (this.refuseMoveWhileSitting()) {
      return;
    }
    const me = this.client?.Me;
    if (me) {
      // Before both the path check below (which starts from where we are) and
      // CommandMoveTo, which declares that same position as the order's origin
      // and immediately reports it again via ValidatePosition. Redirecting
      // mid-walk would otherwise hand the server a position up to a heartbeat
      // stale -- see reportRenderedPosition.
      this.reportRenderedPosition(me);
    }
    if (!this.isStraightPathClear(x, y, z, "move to")) {
      return;
    }
    this.client?.moveTo(x, y, z);
  }

  /**
   * Geodata veto on anything that would send a move order (or act on
   * something we'd have to walk to): true unless the geodata we have loaded
   * positively says the straight line from where we stand to (x, y, z) is
   * blocked -- a cell we can't leave in that direction, a wall/ledge at our
   * own level, a hole in the world, or a destination that turns out to be on
   * a different layer than the one the walk lands on. See canMoveStraight for
   * what each of those means and why unknown/unloaded geodata never vetoes.
   *
   * The point is to not send a packet the server is only going to reject (or,
   * worse, honour by sliding us along a wall): the real client does the same
   * check locally before asking. Note the server stays authoritative either
   * way -- this only ever *withholds* a request, it never moves us.
   */
  private isStraightPathClear(x: number, y: number, z: number, what: string): boolean {
    const me = this.client?.Me;
    if (!me) {
      return true;
    }

    const result = canMoveStraight(loadedGeoTiles(), { x: me.X, y: me.Y, z: me.Z }, { x, y, z });
    if (!result.canMove) {
      console.debug(
        `[geodata] ${what} (${x}, ${y}, ${z}) refused: ${result.verdict}, reachable only to`,
        result.stopAt
      );
    }
    return result.canMove;
  }

  /**
   * Movement veto while sitting, and the reason the click still gets an
   * answer. The server refuses a move order outright here ("You cannot move
   * while sitting"), so the order is withheld for the same reason the geodata
   * gate withholds one -- but with an extra bite: CommandMoveTo predicts the
   * walk locally the moment it sends the request, and a refusal is not a
   * position correction. The server has no reason to tell us where we are for
   * a move it never accepted, so the predicted walk would run its full course
   * with the character sitting, which is exactly the symptom.
   *
   * Unlike the geodata gate this one speaks up, because the server would
   * have: the same message it sends is recorded locally, so a click that does
   * nothing says why instead of being silently swallowed.
   */
  private refuseMoveWhileSitting(): boolean {
    if (!this.client?.Me?.IsSitting) {
      return false;
    }
    this.recordSystemMessage(CANNOT_MOVE_WHILE_SITTING_MESSAGE_ID, [], []);
    return true;
  }

  /**
   * Cancels whatever the player is currently doing: a queued "walk into
   * range then act" intent (see pendingAction) and/or an in-progress walk.
   * Bound to Escape -- see App.tsx.
   *
   * There's no dedicated "stop" packet to send: StopMove only ever arrives
   * from the server (see StopMoveMutator in @lineage2js/network), it isn't
   * something the client can ask for. The same trick moveTo() already leans
   * on for a mid-walk redirect works here too -- ordering a move to our own
   * current (rendered) position leaves the server nowhere left to walk us,
   * which ends the segment right where we stand.
   */
  cancelCurrentAction() {
    this.pendingAction = undefined;
    const me = this.client?.Me;
    if (!me) {
      return;
    }
    this.reportRenderedPosition(me);
    if (creatureMoveState(me).isMoving) {
      this.client?.moveTo(me.X, me.Y, me.Z);
    }
  }

  /**
   * Starts the pick-up window for a creature, off the server's own "X picked
   * up Y" broadcast (GetItem), so other players' pick-ups animate too.
   *
   * A window rather than a flag the server maintains, because there is no
   * such flag: the pick-up is an instant on the server and only the animation
   * takes time. It only has to outlast the clip -- once that finishes the
   * body hands itself back to idle (see GltfCharacterModel's SETTLES_INTO),
   * so an over-long window is harmless, while a short one would cut the
   * animation off mid-stoop. The one thing it does cost: a second pick-up
   * inside the window extends it rather than replaying the stoop, so grabbing
   * a pile of drops animates once rather than once per item.
   */
  private notePickup(creatureId: number) {
    const now = Date.now();
    for (const [id, until] of this.pickingUpUntil) {
      if (until <= now) this.pickingUpUntil.delete(id);
    }
    this.pickingUpUntil.set(creatureId, now + PICKUP_ANIMATION_MS);
    this.gestureStartedAt.set(creatureId, now);
  }

  private isPickingUp(creatureId: number): boolean {
    return (this.pickingUpUntil.get(creatureId) ?? 0) > Date.now();
  }

  /**
   * Starts the casting window for a creature, off the server's own "X is
   * casting Y" broadcast (MagicSkillUse), so other players' casts animate
   * too.
   *
   * Unlike the pick-up stoop this deadline is the server's: the packet's
   * HitTime is how long the cast takes, so the body holds the pose for
   * exactly as long as the character is actually casting -- a slower caster
   * lingers, a hasted one snaps out of it, and neither needs a number
   * invented here. An instant skill (HitTime 0) opens no window at all.
   *
   * MagicSkillUse covers physical skills as well as spells, so a sword
   * technique plays the cast motion too. That's the retail client's own
   * behaviour for the cast bar, and telling the two apart needs the skill's
   * own datapack entry, which nothing reads here yet.
   */
  private noteCast(creatureId: number, hitTime: number) {
    if (hitTime <= 0) {
      return;
    }
    const now = Date.now();
    for (const [id, until] of this.castingUntil) {
      if (until <= now) this.castingUntil.delete(id);
    }
    this.castingUntil.set(creatureId, now + hitTime);
    this.gestureStartedAt.set(creatureId, now);
  }

  /** Ends it early, on the server's own "the skill went off" (MagicSkillLaunched). */
  private noteCastFinished(creatureId: number) {
    this.castingUntil.delete(creatureId);
  }

  private isCasting(creatureId: number): boolean {
    return (this.castingUntil.get(creatureId) ?? 0) > Date.now();
  }

  /**
   * Starts the stand-up window, off the server's own ChangeWaitType -- only
   * on the seated -> standing edge, since the packet also arrives for sitting
   * down and for fake death.
   *
   * Worth drawing precisely because the server does not treat standing up as
   * instant: it broadcasts the standing flag straight away but keeps refusing
   * move orders for its own stand-up delay afterwards. Without the motion the
   * character snapped upright and then ignored clicks for two and a half
   * seconds with nothing on screen to explain it.
   */
  private noteStandUp(creatureId: number) {
    const now = Date.now();
    for (const [id, until] of this.standingUpUntil) {
      if (until <= now) this.standingUpUntil.delete(id);
    }
    this.standingUpUntil.set(creatureId, now + STAND_UP_ANIMATION_MS);
    this.gestureStartedAt.set(creatureId, now);
  }

  private isStandingUp(creatureId: number): boolean {
    return (this.standingUpUntil.get(creatureId) ?? 0) > Date.now();
  }

  /**
   * Starts the swing window, off the server's Attack broadcast -- so every
   * attacker in view swings, not just whoever we are watching. Repeated hits
   * inside the window extend it rather than restarting the clip, which is
   * what keeps a sustained fight looking continuous instead of stuttering
   * back to the first frame on every blow.
   */
  private noteAttack(creatureId: number) {
    const now = Date.now();
    for (const [id, until] of this.attackingUntil) {
      if (until <= now) this.attackingUntil.delete(id);
    }
    this.attackingUntil.set(creatureId, now + ATTACK_ANIMATION_MS);
    this.gestureStartedAt.set(creatureId, now);
  }

  private isAttacking(creatureId: number): boolean {
    return (this.attackingUntil.get(creatureId) ?? 0) > Date.now();
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

  /** Dismisses the "npc-dialogue" window without telling the server anything -- there's no "close" packet in this protocol, the real client just stops showing the window locally. */
  closeNpcDialogue() {
    this.npcDialogue = undefined;
  }

  /** Sends a bypass string back to the server (see l2-link's "l2npcbypass" CustomEvent in npc-dialogue.window.tsx). Doesn't clear npcDialogue itself -- a bypass click normally gets a fresh NpcHtmlMessage back, which replaces it; if the server sends nothing back, the window is left showing the same (now-stale) content until the player closes it, same as the real client. */
  sendNpcBypass(action: string) {
    this.client?.dialog(action);
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

  acceptPairAction() {
    this.client?.acceptCoupleAction();
    this.pairActionRequest = undefined;
  }

  declinePairAction() {
    this.client?.declineCoupleAction();
    this.pairActionRequest = undefined;
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
   * Queues `onArrive` to run once we're within `range` world units of the
   * given creature -- if we already are, immediately; otherwise sends a
   * real move-to request and re-evaluates the next time we stop moving
   * (see advancePendingAction), same as the real client walking into range
   * before actually attacking/interacting instead of rejecting the action.
   */
  private queueActionInRange(targetId: number, range: number, onArrive: () => void) {
    this.pendingAction = { targetId, range, onArrive };
    this.advancePendingAction();
  }

  /**
   * Drives the queued pending action (if any) one step: arrived -> run
   * onArrive; not yet in range -> send a move order toward the target's
   * *current* position (it may have moved since this was queued) and wait.
   *
   * Event-driven, not polled: L2Creature.IsMoving fires a "StopMoving"
   * event on the creature itself the moment a move segment finishes --
   * whether that's our own client-side prediction completing (see
   * CommandMoveTo) or a server-echoed MoveToLocation -- and the reference
   * server broadcasts StopMove back to the mover too, not just onlookers
   * (see lineage2ts's L2Character.abortMoving ->
   * BroadcastHelper.dataToSelfBasedOnVisibility). So there's always a
   * concrete moment to re-check from, no need to poll on a timer or on
   * every unrelated syncCreatures tick.
   */
  private advancePendingAction() {
    const pending = this.pendingAction;
    if (!pending) {
      return;
    }

    const target = this.client?.CreaturesList.getEntryByObjectId(pending.targetId);
    const me = this.client?.Me;
    if (!target || !me || target.IsDead) {
      this.pendingAction = undefined;
      return;
    }

    if (Math.hypot(target.X - me.X, target.Y - me.Y) <= pending.range) {
      this.pendingAction = undefined;
      pending.onArrive();
      return;
    }

    if (this.refuseMoveWhileSitting()) {
      // Same dead end as a blocked path below -- no move order goes out, so
      // no StopMoving will ever arrive to re-enter this.
      this.pendingAction = undefined;
      return;
    }

    this.reportRenderedPosition(me);

    if (!this.isStraightPathClear(target.X, target.Y, target.Z, "chase to")) {
      // Nothing to wait for -- no move order goes out, so no StopMoving will
      // ever arrive to re-enter this. Drop the intent instead of leaving it
      // pending forever.
      this.pendingAction = undefined;
      return;
    }

    this.client?.moveTo(target.X, target.Y, target.Z);
    me.once("StopMoving", () => this.advancePendingAction());
  }

  /**
   * While the local player is moving, reports our own position back to the
   * server (RequestValidatePosition) about once a second -- matching the
   * real client's cadence (inferred from L2J_Mobius's ValidatePosition.java
   * out-of-sync check, `calculateDistance3D(...) > getMoveSpeed()`: moveSpeed
   * is a *per-second* rate, so that comparison only makes sense if the
   * client reports roughly that often -- corroborated by the reference
   * server's own rate limit on this packet, 2/sec, id est "about 1/sec plus
   * slack"). Without this the server never hears from us mid-walk at all
   * (see GameStore.moveTo's own docs), only at the start of each move
   * order. One heartbeat per real ActiveChar instance -- see
   * moveHeartbeatChar's guard against re-attaching on every UserInfo.
   *
   * Each beat re-syncs our tracked position first (see
   * reportRenderedPosition) so what we report is the same place we're drawing
   * ourselves.
   */
  private setupMoveHeartbeat(me: L2User) {
    if (this.moveHeartbeatChar === me) {
      return;
    }
    this.moveHeartbeatChar = me;

    me.on("StartMoving", () => {
      if (this.moveHeartbeatInterval) {
        clearInterval(this.moveHeartbeatInterval);
      }
      this.moveHeartbeatInterval = setInterval(() => {
        this.reportRenderedPosition(me);
        this.client?.validatePosition();
      }, 1000);
    });

    me.on("StopMoving", () => {
      if (this.moveHeartbeatInterval) {
        clearInterval(this.moveHeartbeatInterval);
        this.moveHeartbeatInterval = null;
      }
    });
  }

  /**
   * Keeps a NetPing exchange running while we're in the world, and turns it
   * into a latency reading.
   *
   * High Five's NetPing is client-opened: the server only ever answers, never
   * pings unprompted (lineage2ts's receive/RequestNetPing.ts replies with
   * send/NetPing.ts and that is the packet's only sender), so nothing arrives
   * unless we ask. C4-era documentation has this the other way round -- there
   * the server pinged and an unanswered ping was a problem -- which does not
   * apply to this protocol version.
   *
   * The round trip is measured here rather than read off the reply, because
   * it's the part we can be sure of: the reply's own payload is the server's
   * online time, whose unit the reference doesn't pin down (see the network
   * package's incoming/game/NetPing.ts). It's carried through as-is anyway.
   *
   * Every NET_PING_INTERVAL_MS, well inside the reference server's own rate
   * limit on this packet (2/sec). Called on every UserInfo (world (re-)enter
   * is the only reliable "definitely still connected" signal available), but
   * only actually (re)starts the loop if one isn't already running --
   * UserInfo can legitimately arrive more than once while already in the
   * same world session (stat recalc, sit/stand, ... depending on the server
   * build), and tearing the interval down + firing an extra immediate ping
   * on every one of those would keep resetting the 10s cadence so the
   * scheduled ping never gets a chance to land, spending the reference
   * server's 2/sec-per-account rate limit on nothing but immediate pings --
   * which reads client-side as the round trip never completing at all.
   */
  private setupNetPing() {
    if (this.netPingInterval) {
      return;
    }

    const ping = () => {
      if (this.netPingSentAt !== undefined) {
        // The previous request never got a reply inside a full interval --
        // surface it instead of silently retrying forever, so a genuinely
        // unanswered RequestNetPing (0xb1) doesn't just look identical to
        // "still measuring the first one" in the radar readout.
        this.netPingTimedOut = true;
        console.warn(
          `[NetPing] No reply to RequestNetPing (0xb1) within ${NET_PING_INTERVAL_MS}ms -- the server may be rate-limiting or not answering it.`
        );
      }
      this.netPingSentAt = Date.now();
      this.client?.netPing();
    };
    ping();
    this.netPingInterval = setInterval(ping, NET_PING_INTERVAL_MS);
  }

  /**
   * Turns a landed NetPing reply into a latency reading (see setupNetPing).
   * Ignores a reply with no outstanding request behind it -- there's nothing
   * to measure against, and a stale one would read as an absurd round trip.
   */
  private recordNetPing(onlineTime: number | undefined) {
    if (this.netPingSentAt !== undefined) {
      this.latencyMs = Date.now() - this.netPingSentAt;
      this.netPingSentAt = undefined;
      this.netPingTimedOut = false;
    }
    this.onlineTime = onlineTime;
  }

  private stopNetPing() {
    if (this.netPingInterval) {
      clearInterval(this.netPingInterval);
      this.netPingInterval = null;
    }
    this.netPingSentAt = undefined;
    this.netPingTimedOut = false;
  }

  /**
   * Pulls the local player's tracked position onto the one we're actually
   * drawing, right before reporting it (RequestValidatePosition carries x, y,
   * z and heading -- see lineage2ts's own client-side send of this packet,
   * which this client's outgoing ValidatePosition matches field for field).
   *
   * The two are computed from the same move segment but by different means,
   * and they drift apart. The renderer solves the segment analytically for
   * "now" (interpolatedCreaturePosition), while the tracked value is
   * L2Creature's own 100ms stepper accumulating floor()ed integer deltas -- so
   * it trails the drawn position by a few units a second on its own, and by
   * far more whenever those timer ticks don't land on time (a browser clamps
   * setInterval to once a second in a background tab, which stalls the stepper
   * while wall-clock -- and the server -- keep going). Z drifts for a
   * different reason on top: the stepper walks it linearly from the segment's
   * origin height to its destination height, and a straight line between two
   * endpoints is not the terrain between them, while the renderer reads the
   * geodata surface (see creature-movement.ts's gravity).
   *
   * The reference server acts on both. lineage2ts's ValidatePosition handler
   * treats a reported position more than 500 units off its own as out of sync,
   * and a reported Z more than 200 off; depending on how far out it either
   * re-grounds itself (GeoPolygonCache.getObjectZ -- its own gravity) or
   * replies with a corrective ValidateLocation, the second of which is a
   * visible snap-back. Reporting the drawn position keeps us inside those
   * tolerances, and it's the honest answer anyway: it's where this client
   * believes it is.
   *
   * A no-op while standing still: a resting position came from the server's
   * own MoveToLocation destination and is already authoritative (setMovingTo
   * snaps to it on arrival), so there's nothing to correct it toward.
   * Rounded because the wire field is an int32, which the stepper's
   * fractional Z wasn't.
   */
  private reportRenderedPosition(me: L2User) {
    const state = creatureMoveState(me);
    if (!state.isMoving) {
      return;
    }
    const rendered = interpolatedCreaturePosition(state);
    me.X = Math.round(rendered.x);
    me.Y = Math.round(rendered.y);
    me.Z = Math.round(rendered.z);
  }

  /**
   * Attacks the current target (AttackRequest) -- walks into melee range
   * first if it's currently out of reach (see queueActionInRange), same as
   * the real client does instead of just rejecting a distant Attack click.
   */
  attack() {
    const target = this.target;
    if (!target) {
      return;
    }
    this.queueActionInRange(target.objectId, MELEE_ATTACK_RANGE, () => {
      this.client?.attack(target.objectId);
    });
  }

  /**
   * Talks to the current target -- same shape as attack() (walk into range
   * first via queueActionInRange, same "walk there first" feel the real
   * client has for a distant double-click). The talk itself isn't wired up
   * on arrival: there's no NPC dialog/bypass system in this client yet (see
   * TODO.md's "Add NPC dialog system" entry), so this only gets the player
   * there for now.
   */
  talkToNpc() {
    const target = this.target;
    if (!target) {
      return;
    }
    this.queueActionInRange(target.objectId, NPC_INTERACT_RANGE, () => {});
  }

  /**
   * Assists the current target (only valid when it's a party member) --
   * there's no RequestActionUse case or dedicated packet for this (see the
   * PICK_UP-style investigation in user-actions.ts's history), but the
   * server broadcasts TargetSelected to every nearby player whenever
   * *anyone* selects a target (Player.java's Broadcast.toKnownPlayers call),
   * which TargetSelectedMutator already uses to keep every tracked
   * creature's own .Target field live -- not just ours. So "assist" is just
   * "attack whatever my target is currently targeting", read off the live
   * L2Creature in CreaturesList rather than the flattened TargetSnapshot.
   * No-ops if we haven't seen that member retarget since they came into
   * view (Target still null) or they have no target at all.
   */
  assist() {
    const target = this.target;
    if (!target || target.creatureKind || !this.party.some((member) => member.ObjectId === target.objectId)) {
      return;
    }
    const theirTarget = this.client?.CreaturesList.getEntryByObjectId(target.objectId)?.Target;
    if (!theirTarget) {
      return;
    }
    this.client?.hit(theirTarget);
  }

  /** Invites the current target to a party (RequestJoinParty) -- only valid for a player target not already in the party. */
  inviteToParty() {
    const target = this.target;
    if (!target || target.creatureKind || this.party.some((member) => member.ObjectId === target.objectId)) {
      return;
    }
    this.client?.requestJoinParty(target.name);
  }

  /** Challenges the current target (or their whole party, if partyDuel) to a duel (RequestDuelStart) -- only valid for a player target. */
  challengeToDuel(partyDuel = false) {
    const target = this.target;
    if (!target || target.creatureKind) {
      return;
    }
    this.client?.requestDuel(target.name, partyDuel);
  }

  /** Leaves the current party (RequestWithDrawalParty) -- only valid while actually in one. */
  leaveParty() {
    if (this.party.length === 0) {
      return;
    }
    this.client?.leaveParty();
  }

  /** Whether the local player currently leads their own party (see the DISMISS_PARTY_MEMBER/CHANGE_PARTY_LEADER guards below -- the server only honors those requests from the actual leader, per RequestOustPartyMember.java/RequestChangePartyLeader.java). */
  isPartyLeader(): boolean {
    return this.party.find((member) => member.ObjectId === this.me)?.IsPartyLeader ?? false;
  }

  /** Sends a trade request to the current target (TradeRequest) -- only valid for a player target. */
  requestTrade() {
    const target = this.target;
    if (!target || target.creatureKind) {
      return;
    }
    this.client?.requestTrade(target.objectId);
  }

  /** Dismisses the current target from the party (RequestOustPartyMember) -- only valid when the local player is the party leader and the target is a (different) player in the party. */
  dismissPartyMember() {
    const target = this.target;
    if (
      !target ||
      target.creatureKind ||
      target.objectId === this.me ||
      !this.isPartyLeader() ||
      !this.party.some((member) => member.ObjectId === target.objectId)
    ) {
      return;
    }
    this.client?.dismissPartyMember(target.name);
  }

  /** Transfers party leadership to the current target (RequestChangePartyLeader) -- only valid when the local player is the party leader and the target is a (different) player in the party. */
  changePartyLeader() {
    const target = this.target;
    if (
      !target ||
      target.creatureKind ||
      target.objectId === this.me ||
      !this.isPartyLeader() ||
      !this.party.some((member) => member.ObjectId === target.objectId)
    ) {
      return;
    }
    this.client?.changePartyLeader(target.name);
  }

  /** Sends a pair (couple) social-action request to the current target (RequestActionUse -- the server relays it to the target as ExAskCoupleAction, see GameStore.pairActionRequest's field comment) -- only valid for a different player target. */
  requestPairAction(actionKey: "EXCHANGE_BOWS" | "HIGH_FIVE" | "COUPLE_DANCE") {
    const target = this.target;
    if (!target || target.creatureKind || target.objectId === this.me) {
      return;
    }
    this.client?.action(actionKey);
  }

  /** Sends a bare RequestActionUse -- for actions with no precondition beyond the server's ExBasicActionList check already reflected in the slot's visual state (see user-actions.ts). */
  useBasicAction(actionKey: keyof typeof Actions) {
    this.client?.action(actionKey);
  }

  /** Selects the next/closest attackable target (see Client.nextTarget()) -- the resulting MyTargetSelected event is what actually updates `target` (see the syncTarget handler in bindToClient). */
  selectNextTarget() {
    this.client?.nextTarget();
  }

  /**
   * Picks up the nearest tracked dropped item. RequestActionUse has no case
   * for PICK_UP at all (confirmed against the reference server's
   * RequestActionUse.java -- ids 2-9 aren't handled there, they all have
   * their own dedicated packets), so this is presumably the same trick the
   * real client plays: find the closest item and click it exactly like the
   * player would (client.hit(), the same Action packet DropItemMutator's
   * Distance -- computed once at drop time -- exists to support). No-ops
   * when nothing is tracked nearby.
   */
  pickUpNearestItem() {
    let nearest: L2Item | undefined;
    for (const item of this.client?.DroppedItems ?? []) {
      if (!nearest || item.Distance < nearest.Distance) {
        nearest = item;
      }
    }
    if (!nearest) {
      return;
    }
    this.client?.hit(nearest);
  }

  /** Picks up a specific tracked dropped item by objectId -- same client.hit() mechanism as pickUpNearestItem, for clicking a specific item marker in the 3D scene instead of always grabbing the closest one. */
  pickUpItem(objectId: number) {
    if (!this.client?.DroppedItems.containsObjectId(objectId)) {
      return;
    }
    this.client.hit(objectId);
  }

  /**
   * Opens the skill's detail window and asks the trainer for its
   * authoritative SpCost/Requirements (RequestAcquireSkillInfo) --
   * syncSkillRequirements picks up the AcquireSkillInfo reply and fills in
   * requiredItem. Offline/demo mode just uses the snapshot as-is (the
   * command itself no-ops while disconnected).
   */
  selectLearnableSkill(skill: LearnableSkillSnapshot) {
    this.selectedLearnableSkill = skill;
    this.client?.requestAcquireSkillInfo(skill.id, skill.level, AcquireSkillType.CLASS);
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

  isAutoShotEnabled(itemId: number): boolean {
    return this.autoShotItemIds.has(itemId);
  }

  /** Toggles auto-use for a soulshot/spiritshot item (RequestAutoSoulShot) -- hotbar's RMB handler for shot slots only (see item-mapping.ts's isShotItem, hotbar.window.tsx). */
  toggleAutoShot(item: L2Item) {
    const enable = !this.autoShotItemIds.has(item.Id);
    if (enable) {
      this.autoShotItemIds.add(item.Id);
    } else {
      this.autoShotItemIds.delete(item.Id);
    }
    this.client?.autoShots(item, enable);
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
      // Guards against a server that re-sends a full ShortCutInit a moment
      // after processing a delete, but before that delete has actually
      // persisted server-side -- the just-deleted slot can reappear in that
      // stale snapshot. Blank any slot we recently told the server to
      // delete, for a short grace window, instead of trusting it back in.
      const now = Date.now();
      for (const [pendingSlot, deletedAt] of this.pendingHotbarDeletes) {
        if (now - deletedAt > GameStore.HOTBAR_DELETE_GRACE_MS) {
          this.pendingHotbarDeletes.delete(pendingSlot);
          continue;
        }
        if (slots[pendingSlot]) {
          slots[pendingSlot] = undefined;
        }
      }

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
        pledgeClass: me.PledgeClass,
        className: getClassLabel(me.ClassId),
        clanId: me.ClanId,
        // The wire carries a 0..1 fraction (L2User.ExpFraction); the bar
        // and its "96.00%" readout want 0-100. `|| 0` covers the gap
        // before the first UserInfo arrives, same as vitalityPercent's
        // inputs -- NaN would render as an empty bar labelled "NaN%".
        expPercent: (me.ExpFraction || 0) * 100,
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

      // Includes the local player -- ActiveChar is a real member of
      // CreaturesList too (see CharSelectedMutator), so self gets the exact
      // same WorldCreatureSnapshot treatment (race/baseClass/sex included)
      // as everyone else. Find it back via GameStore.me as the map key.
      const next = new Map<number, WorldCreatureSnapshot>();
      for (const creature of client.CreaturesList) {
        next.set(
          creature.ObjectId,
          worldCreatureSnapshotFromCreature(creature, {
            isPickingUp: this.isPickingUp(creature.ObjectId),
            isCasting: this.isCasting(creature.ObjectId),
            isStandingUp: this.isStandingUp(creature.ObjectId),
            isAttacking: this.isAttacking(creature.ObjectId),
            gestureStartedAt: this.gestureStartedAt.get(creature.ObjectId),
          })
        );
      }
      this.creatures = next;
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

    // Ground items (SpawnItem/DropItem) for the 3D scene -- same
    // rebuild-whole-map-from-the-network-layer's-own-collection approach as
    // syncCreatures, since client.DroppedItems is already kept consistent by
    // SpawnItemMutator/DropItemMutator/DeleteObjectMutator. No 150ms poll
    // needed here (unlike creatures) -- items never move once spawned, so
    // there's nothing to keep ticking between packets.
    const syncDroppedItems = () => runInAction(() => {
      if (!client.GameClient.IsConnected) {
        return;
      }
      const next = new Map<number, WorldItemSnapshot>();
      for (const item of client.DroppedItems) {
        next.set(item.ObjectId, worldItemSnapshotFromItem(item));
      }
      this.droppedItems = next;
    });

    // Re-syncs immediately rather than waiting on the poll below: a pick-up
    // is over in about a second, and a third of that spent standing still
    // would be the visible part.
    client.on("GetItem", (e: EGetItem) => {
      runInAction(() => this.notePickup(e.data.creatureId));
      syncCreatures();
    });

    // Same immediacy for casting: waiting on the poll would eat the first
    // frames of a cast that can be under a second to begin with.
    client.on("MagicSkillUse", (e: EMagicSkillUse) => {
      runInAction(() => this.noteCast(e.data.creatureId, e.data.hitTime));
      syncCreatures();
    });

    client.on("MagicSkillLaunched", (e: EMagicSkillLaunched) => {
      runInAction(() => this.noteCastFinished(e.data.creatureId));
      syncCreatures();
    });

    // Only the seated -> standing edge starts the stand-up motion; the same
    // packet also announces sitting down and fake death, and the snapshot
    // still holds the previous state at this point (syncCreatures below is
    // what replaces it), which is what makes the edge visible here at all.
    client.on("ChangeWaitType", (e: EChangeWaitType) => {
      const wasSitting = this.creatures.get(e.data.creatureId)?.isSitting ?? false;
      if (wasSitting && !e.data.isSitting) {
        runInAction(() => this.noteStandUp(e.data.creatureId));
      }
      syncCreatures();
    });

    client.on("Attacked", (e: EAttacked) => {
      runInAction(() => this.noteAttack(e.data.object));
      syncCreatures();
    });

    client.on("PacketReceived", "SpawnItem", syncDroppedItems);
    client.on("PacketReceived", "DropItem", syncDroppedItems);
    client.on("PacketReceived", "DeleteObject", syncDroppedItems);
    // TeleportToLocationMutator clears client.DroppedItems (a new area's
    // items haven't been (re-)announced yet) -- re-sync so stale markers
    // from the old location don't linger in the scene until the next spawn.
    client.on("PacketReceived", "TeleportToLocation", syncDroppedItems);

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
      this.pairActionRequest = undefined;
      this.npcDialogue = undefined;
    }));
    // UserInfo is also the first point client.Me is guaranteed to be this
    // session's real, long-lived ActiveChar instance (CharSelectedMutator
    // assigns a fresh object at char-select; UserInfoMutator only mutates
    // it in place afterward, see that mutator's own comment) -- safe to
    // attach the StartMoving/StopMoving listeners here.
    client.on("PacketReceived", "UserInfo", () => this.setupMoveHeartbeat(client.Me));
    client.on("PacketReceived", "UserInfo", () => this.setupNetPing());
    client.on("PacketReceived", "NetPing", () => runInAction(() => this.recordNetPing(client.OnlineTime)));
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

    // Drives the "pair-action-request" window (High Five/Exchange Bows/
    // Couple Dance). Accepting only sends the answer -- this client has no
    // couple-action animation playback.
    // Drives the "npc-dialogue" window. See npc-dialogue.window.tsx for the
    // html dialect -> React tree translation (packages/ui/src/lib/npc-html).
    client.on("NpcHtmlMessage", (e: ENpcHtmlMessage) => runInAction(() => {
      this.npcDialogue = e.data;
    }));

    client.on("PairActionRequest", (e: EPairActionRequest) => runInAction(() => {
      this.pairActionRequest = {
        requesterName: e.data.requesterName,
        actionId: e.data.actionId,
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
      this.stopNetPing();
    }));
    client.GameClient.on("Disconnected", () => runInAction(() => {
      this.isDisconnected = true;
      this.stopNetPing();
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
