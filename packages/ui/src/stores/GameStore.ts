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
  type Client,
} from "@lineage2js/network";

export interface Creature {
  id: string;
}

export const MAX_CHARACTERS = 7;

const HOTBAR_SLOT_COUNT = 48; // 4 rows x 12 columns, matches the wire's slot + page*12 addressing

// H5-era vitality system: 0-36000 raw points, shown as a single 0-100% bar
// (not the later Vitality Herb chronicles' 140000/5-level system). Not read
// from any packet field -- confirm against the target server if it differs.
export const MAX_VITALITY_POINTS = 36000;

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
    vitalityPercent: (27000 / MAX_VITALITY_POINTS) * 100,
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
  // Non-player creature kind (L2Mob/L2Npc/L2Summon), for a type icon --
  // only set when the target is NOT a player.
  creatureKind?: CreatureKind;
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
    };
  }

  return {
    ...base,
    creatureKind: creature instanceof L2Mob ? "mob" : creature instanceof L2Summon ? "summon" : "npc",
  };
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
    client.on("PacketReceived", "StatusUpdate", syncCharInfo);

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
  }
}
