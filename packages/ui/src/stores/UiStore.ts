import { makeAutoObservable } from "mobx";
import type { LANG } from "../lang/lang";

export type Screen = "login" | "select-char" | "create-char" | "game";

export class UiStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  screen: Screen = "login";
  lang: LANG = "en";

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
}
