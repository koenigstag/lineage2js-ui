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
}
