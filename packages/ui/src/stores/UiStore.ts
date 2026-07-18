import { makeAutoObservable } from "mobx";
import { getSession } from "../lib/session";

export type Screen = "login" | "select-char" | "create-char" | "game";

function getInitialScreen(): Screen {
  if (!getSession()) {
    return "login";
  }

  const hashScreen = window.location.hash.slice(1);
  return hashScreen === "create-char" || hashScreen === "game" ? hashScreen : "select-char";
}

export class UiStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  screen: Screen = getInitialScreen();

  constructor() {
    makeAutoObservable(this);
  }

  setConnectionStatus(status: UiStore["connectionStatus"]) {
    this.connectionStatus = status;
  }

  setScreen(screen: UiStore["screen"]) {
    this.screen = screen;
  }
}
