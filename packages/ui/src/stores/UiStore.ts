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
  /** id -> name, see lang.ts's "skill.name.<id>" special case. Same gap as items -- SkillList/AcquireSkillInfo never send skill name strings. */
  skillNames: Record<string, string> = {};
  private skillNamesRequested = false;
  /**
   * id -> name for the current lang, see lang.ts's "action.name.<id>" special
   * case. Unlike items/skills, sourced ourselves (not server-sent) in both
   * en/ru, so it's cached per-language and reloaded on setLang() instead of
   * being a one-shot English-only fetch.
   */
  actionNames: Record<string, string> = {};
  private actionNamesCache: Partial<Record<LANG, Record<string, string>>> = {};
  /** npcId -> race code (e.g. "UNDEAD"), see config/npc-race-mapping.ts. Not localized -- these are enum codes, not display strings. */
  npcRaces: Record<string, string> = {};
  private npcRacesRequested = false;
  /** npcId -> level, see config/npc-level-mapping.ts. Same datapack source/gap as npcRaces -- NpcInfo never sends a monster's level over the wire. */
  npcLevels: Record<string, number> = {};
  private npcLevelsRequested = false;
  /** messageId -> template string ("$s1"/"$c1" placeholders), see config/system-message-mapping.ts. English-only -- the wire only ever sends numeric ids/params, never text. */
  systemMessages: Record<string, string> = {};
  private systemMessagesRequested = false;

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

  /** Fetches the skill-name table once (public/skill-names/en.json), same treatment as loadItemNames(). */
  async loadSkillNames() {
    if (this.skillNamesRequested) return;
    this.skillNamesRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}skill-names/en.json`);
      const names: Record<string, string> = await response.json();
      this.setSkillNames(names);
    } catch {
      this.skillNamesRequested = false;
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

  /** Fetches public/system-messages/en.json once, same treatment as loadItemNames(). */
  async loadSystemMessages() {
    if (this.systemMessagesRequested) return;
    this.systemMessagesRequested = true;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}system-messages/en.json`);
      const messages: Record<string, string> = await response.json();
      this.setSystemMessages(messages);
    } catch {
      this.systemMessagesRequested = false;
    }
  }
}
