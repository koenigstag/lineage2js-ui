import { makeAutoObservable } from "mobx";
import type { LANG } from "../lang/lang";

export type Screen = "login" | "select-char" | "create-char" | "game";

export class UiStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  screen: Screen = "login";
  lang: LANG = "en";
  /** id -> name, see lang.ts's "item.name.<id>" special case. English-only for now (no server-sent item names, see network's readItem()). */
  itemNames: Record<string, string> = {};
  private itemNamesRequested = false;
  /**
   * id -> name for the current lang, see lang.ts's "skill.name.<id>" special
   * case. The server never sends skill name strings (SkillList/
   * AcquireSkillInfo are id/level only) -- sourced from adrenalinebot.com's
   * HighFive database instead (public/skill-names/<lang>.json), same
   * per-language caching as actionNames/classNames.
   */
  skillNames: Record<string, string> = {};
  private skillNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /**
   * id -> name for the current lang, see lang.ts's "action.name.<id>" special
   * case. Unlike items/skills, sourced ourselves (not server-sent) in both
   * en/ru, so it's cached per-language and reloaded on setLang() instead of
   * being a one-shot English-only fetch.
   */
  actionNames: Record<string, string> = {};
  private actionNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /** classId -> name for the current lang (public/class-names/<lang>.json, sourced from adrenalinebot.com's HighFive database -- see class-tree.ts's getClassLabel()). Same per-language caching as actionNames. */
  classNames: Record<string, string> = {};
  private classNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /** npcId -> race code (e.g. "UNDEAD"), see config/npc-race-mapping.ts. Not localized -- these are enum codes, not display strings. */
  npcRaces: Record<string, string> = {};
  private npcRacesRequested = false;
  /** npcId -> level, see config/npc-level-mapping.ts. Same datapack source/gap as npcRaces -- NpcInfo never sends a monster's level over the wire. */
  npcLevels: Record<string, number> = {};
  private npcLevelsRequested = false;
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

  setConnectionStatus(status: UiStore["connectionStatus"]) {
    this.connectionStatus = status;
  }

  setScreen(screen: UiStore["screen"]) {
    this.screen = screen;
  }

  setLang(lang: LANG) {
    this.lang = lang;
    this.loadActionNames();
    this.loadClassNames();
    this.loadSkillNames();
    this.loadSystemMessages();
  }

  setItemNames(names: Record<string, string>) {
    this.itemNames = names;
  }

  /** Fetches the item-name table once (public/item-names/en.json) and caches it in memory for the session -- the browser's own HTTP cache covers repeat page loads. */
  async loadItemNames() {
    if (this.itemNamesRequested) return;
    this.itemNamesRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}item-names/en.json`);
      const names: Record<string, string> = await response.json();
      this.setItemNames(names);
    } catch {
      this.itemNamesRequested = false;
    }
  }

  setSkillNames(names: Record<string, string>) {
    this.skillNames = names;
  }

  /** Fetches public/skill-names/<lang>.json for the current lang, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadSkillNames() {
    const lang = this.lang;
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

  /** Fetches public/action-names/<lang>.json for the current lang, caching each language in memory once loaded. */
  async loadActionNames() {
    const lang = this.lang;
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

  /** Fetches public/class-names/<lang>.json for the current lang, caching each language in memory once loaded -- same treatment as loadActionNames(). */
  async loadClassNames() {
    const lang = this.lang;
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

  setSystemMessages(messages: Record<string, string>) {
    this.systemMessages = messages;
  }

  /**
   * Fetches the English base table plus the current lang's translated
   * subset (skipped for English itself), merges them (translated entries
   * win, everything else stays English), and caches the merged result per
   * language so switching languages doesn't re-fetch every time.
   */
  async loadSystemMessages() {
    const lang = this.lang;
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
