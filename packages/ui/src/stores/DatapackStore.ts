import { makeAutoObservable } from "mobx";
import type { LANG } from "../lang/lang";
import type { BaseStats, BaseClass, Race, Sex } from "../config/character-races";

// Static reference data the wire protocol never sends as strings/codes --
// item/skill/action/class/npc/quest names, npc race/level, skill effect
// category, and system-message templates. All of it is fetch-once(-per-lang)
// and cached in memory; none of it is interactive UI state (that's UiStore).
// See App.tsx for what triggers the initial loads and re-loads on lang change.
export class DatapackStore {
  /**
   * id -> name for the current lang, see lang.ts's "item.name.<id>" special
   * case. The server never sends item name strings (ItemList/InventoryUpdate
   * are id/count/etc only) -- sourced from adrenalinebot.com's HighFive
   * database instead (public/item-names/<lang>.json), same per-language
   * caching as skillNames/actionNames/classNames.
   */
  itemNames: Record<string, string> = {};
  private itemNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /**
   * id -> name for the current lang, see lang.ts's "skill.name.<id>" special
   * case. The server never sends skill name strings (SkillList/
   * AcquireSkillInfo are id/level only) -- sourced from adrenalinebot.com's
   * HighFive database instead (public/skill-names/<lang>.json), same
   * per-language caching as actionNames/classNames.
   */
  skillNames: Record<string, string> = {};
  private skillNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /** id -> name for the current lang, see lang.ts's "action.name.<id>" special case. Same source/caching as itemNames/skillNames. */
  actionNames: Record<string, string> = {};
  private actionNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /** classId -> name for the current lang (public/class-names/<lang>.json, sourced from adrenalinebot.com's HighFive database -- see class-tree.ts's getClassLabel()). Same per-language caching as actionNames. */
  classNames: Record<string, string> = {};
  private classNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /**
   * npcId -> name for the current lang, see config/npc-name-mapping.ts's
   * getNpcName(). Only used as a fallback when NpcInfo's own wire name comes
   * back empty (some templates deliberately omit it, see NpcInfo.ts) --
   * sourced from adrenalinebot.com's HighFive database, same per-language
   * caching as itemNames/skillNames.
   */
  npcNames: Record<string, string> = {};
  private npcNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /** npcId -> race code (e.g. "UNDEAD"), see config/npc-race-mapping.ts. Not localized -- these are enum codes, not display strings. */
  npcRaces: Record<string, string> = {};
  private npcRacesRequested = false;
  /** npcId -> level, see config/npc-level-mapping.ts. Same datapack source/gap as npcRaces -- NpcInfo never sends a monster's level over the wire. */
  npcLevels: Record<string, number> = {};
  private npcLevelsRequested = false;
  /** skillId -> [magicClass, operateType, isDebuff], see config/skill-effect-mapping.ts and @lineage2js/network's EffectCategory.ts. Same datapack source/gap as npcRaces -- AbnormalStatusUpdate never sends a buff's category over the wire. */
  skillEffectFields: Record<string, [number, string, number]> = {};
  private skillEffectFieldsRequested = false;
  /**
   * race -> baseClass -> sex -> starting STR/DEX/CON/INT/WIT/MEN, see
   * config/character-races.ts's getBaseStats(). Sourced from L2J_Mobius's
   * HighFive datapack (dist/game/data/stats/chars/baseStats/<ClassName>.xml's
   * base* fields, one file per starting classId) -- only used as the
   * char-create preview's fallback before the real server-provided
   * CharacterTemplate list loads (see network-mapping.ts's getTemplateStats()),
   * so it's keyed by our own Race/BaseClass/Sex rather than the wire's
   * numeric classId. MALE/FEMALE duplicate the same values for every race
   * except Kamael, where the two starting classes (Male/Female Soldier)
   * genuinely differ. Not exhaustive: Dwarf/Kamael have no "mystic" entry
   * since neither race offers a mystic starting class.
   */
  characterBaseStats: Partial<Record<Race, Partial<Record<BaseClass, Record<Sex, BaseStats>>>>> = {};
  private characterBaseStatsRequested = false;
  /** questId -> name for the current lang, see config/quest-mapping.ts's getQuestName(). Forward-looking -- no quest window built yet. Same source/caching as itemNames/skillNames. */
  questNames: Record<string, string> = {};
  private questNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /**
   * messageId -> template string ("$s1"/"$c1" placeholders) for the current
   * lang, see config/system-message-mapping.ts. Only en.json has the full
   * ~3236-entry L2J_Mobius-sourced table; other languages are a curated,
   * hand-translated subset (currently just the battle-log whitelist) that
   * gets merged on top of the English base, so anything untranslated still
   * falls back to English instead of a raw "#123".
   */
  systemMessages: Record<string, string> = {};
  private systemMessagesCache: Partial<Record<LANG, Record<string, string>>> = {};

  constructor() {
    makeAutoObservable(this);
  }

  /** Reloads every per-language table for `lang` -- call whenever UiStore.lang changes (see App.tsx). */
  loadForLang(lang: LANG) {
    this.loadActionNames(lang);
    this.loadClassNames(lang);
    this.loadSkillNames(lang);
    this.loadItemNames(lang);
    this.loadNpcNames(lang);
    this.loadQuestNames(lang);
    this.loadSystemMessages(lang);
  }

  setItemNames(names: Record<string, string>) {
    this.itemNames = names;
  }

  /** Fetches public/item-names/<lang>.json for `lang`, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadItemNames(lang: LANG) {
    const cached = this.itemNamesCache[lang];
    if (cached) {
      this.setItemNames(cached);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}item-names/${lang}.json`);
      const names: Record<string, string> = await response.json();
      this.itemNamesCache[lang] = names;
      this.setItemNames(names);
    } catch {
      // leave itemNames as-is -- t() falls back to the raw "item.name.<id>" key
    }
  }

  setSkillNames(names: Record<string, string>) {
    this.skillNames = names;
  }

  /** Fetches public/skill-names/<lang>.json for `lang`, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadSkillNames(lang: LANG) {
    const cached = this.skillNamesCache[lang];
    if (cached) {
      this.setSkillNames(cached);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}skill-names/${lang}.json`);
      const names: Record<string, string> = await response.json();
      this.skillNamesCache[lang] = names;
      this.setSkillNames(names);
    } catch {
      // leave skillNames as-is -- t() falls back to the raw "skill.name.<id>" key
    }
  }

  setActionNames(names: Record<string, string>) {
    this.actionNames = names;
  }

  /** Fetches public/action-names/<lang>.json for `lang`, caching each language in memory once loaded. */
  async loadActionNames(lang: LANG) {
    const cached = this.actionNamesCache[lang];
    if (cached) {
      this.setActionNames(cached);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}action-names/${lang}.json`);
      const names: Record<string, string> = await response.json();
      this.actionNamesCache[lang] = names;
      this.setActionNames(names);
    } catch {
      // leave actionNames as-is -- t() falls back to the raw "action.name.<id>" key
    }
  }

  setClassNames(names: Record<string, string>) {
    this.classNames = names;
  }

  /** Fetches public/class-names/<lang>.json for `lang`, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadClassNames(lang: LANG) {
    const cached = this.classNamesCache[lang];
    if (cached) {
      this.setClassNames(cached);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}class-names/${lang}.json`);
      const names: Record<string, string> = await response.json();
      this.classNamesCache[lang] = names;
      this.setClassNames(names);
    } catch {
      // leave classNames as-is -- getClassLabel() falls back to deriving from the ClassId enum key
    }
  }

  setNpcNames(names: Record<string, string>) {
    this.npcNames = names;
  }

  /** Fetches public/npc-names/<lang>.json for `lang`, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadNpcNames(lang: LANG) {
    const cached = this.npcNamesCache[lang];
    if (cached) {
      this.setNpcNames(cached);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}npc-names/${lang}.json`);
      const names: Record<string, string> = await response.json();
      this.npcNamesCache[lang] = names;
      this.setNpcNames(names);
    } catch {
      // leave npcNames as-is -- getNpcName() falls back to the "Mob #<id>"/"NPC #<id>" placeholder
    }
  }

  setQuestNames(names: Record<string, string>) {
    this.questNames = names;
  }

  /** Fetches public/quest-names/<lang>.json for `lang`, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadQuestNames(lang: LANG) {
    const cached = this.questNamesCache[lang];
    if (cached) {
      this.setQuestNames(cached);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}quest-names/${lang}.json`);
      const names: Record<string, string> = await response.json();
      this.questNamesCache[lang] = names;
      this.setQuestNames(names);
    } catch {
      // leave questNames as-is -- getQuestName() falls back to "Quest #<id>"
    }
  }

  setNpcRaces(races: Record<string, string>) {
    this.npcRaces = races;
  }

  /**
   * Fetches public/npc-races/data.json once, same treatment as
   * loadItemNames(). Built from L2J_Mobius's HighFive datapack (dist/game/
   * data/stats/npcs/*.xml's <race> per npc id) -- the wire protocol never
   * sends a monster's race, only its template id (see NpcInfo.ts).
   */
  async loadNpcRaces() {
    if (this.npcRacesRequested) return;
    this.npcRacesRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}npc-races/data.json`);
      const races: Record<string, string> = await response.json();
      this.setNpcRaces(races);
    } catch {
      this.npcRacesRequested = false;
    }
  }

  setNpcLevels(levels: Record<string, number>) {
    this.npcLevels = levels;
  }

  /** Fetches public/npc-levels/data.json once, same source/treatment as loadNpcRaces(). */
  async loadNpcLevels() {
    if (this.npcLevelsRequested) return;
    this.npcLevelsRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}npc-levels/data.json`);
      const levels: Record<string, number> = await response.json();
      this.setNpcLevels(levels);
    } catch {
      this.npcLevelsRequested = false;
    }
  }

  setSkillEffectFields(fields: Record<string, [number, string, number]>) {
    this.skillEffectFields = fields;
  }

  /**
   * Fetches public/skill-effect-fields/data.json once, same treatment as
   * loadNpcRaces(). Generated from lineage2ts's own datapack CSV
   * (cli/overrides/data/csv/skills/skills.csv's magicClass/operateType/
   * isDebuff columns, one row per skill id -- taking each id's lowest-level
   * row, since a handful of ids reuse high "levels" for unrelated skill
   * variants, e.g. Spoil's levels 101+).
   */
  async loadSkillEffectFields() {
    if (this.skillEffectFieldsRequested) return;
    this.skillEffectFieldsRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}skill-effect-fields/data.json`);
      const fields: Record<string, [number, string, number]> = await response.json();
      this.setSkillEffectFields(fields);
    } catch {
      this.skillEffectFieldsRequested = false;
    }
  }

  setCharacterBaseStats(stats: Partial<Record<Race, Partial<Record<BaseClass, Record<Sex, BaseStats>>>>>) {
    this.characterBaseStats = stats;
  }

  /** Fetches public/character-base-stats/data.json once, same treatment as loadNpcRaces(). */
  async loadCharacterBaseStats() {
    if (this.characterBaseStatsRequested) return;
    this.characterBaseStatsRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}character-base-stats/data.json`);
      const stats: Partial<Record<Race, Partial<Record<BaseClass, Record<Sex, BaseStats>>>>> = await response.json();
      this.setCharacterBaseStats(stats);
    } catch {
      this.characterBaseStatsRequested = false;
    }
  }

  setSystemMessages(messages: Record<string, string>) {
    this.systemMessages = messages;
  }

  /**
   * Fetches the English base table plus `lang`'s translated subset (skipped
   * for English itself), merges them (translated entries win, everything
   * else stays English), and caches the merged result per language so
   * switching languages doesn't re-fetch every time.
   */
  async loadSystemMessages(lang: LANG) {
    const cached = this.systemMessagesCache[lang];
    if (cached) {
      this.setSystemMessages(cached);
      return;
    }
    try {
      const enResponse = await fetch(`${import.meta.env.BASE_URL}system-messages/en.json`);
      const en: Record<string, string> = await enResponse.json();
      let merged = en;
      if (lang !== "en") {
        try {
          const langResponse = await fetch(`${import.meta.env.BASE_URL}system-messages/${lang}.json`);
          const overrides: Record<string, string> = await langResponse.json();
          merged = { ...en, ...overrides };
        } catch {
          // no translation file for this lang yet -- English fallback for everything
        }
      }
      this.systemMessagesCache[lang] = merged;
      this.setSystemMessages(merged);
    } catch {
      // leave systemMessages as-is -- formatSystemMessage falls back to "#<id>"
    }
  }
}
