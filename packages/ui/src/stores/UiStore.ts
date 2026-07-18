import { makeAutoObservable } from "mobx";
import { getSession } from "../lib/session";

function getInitialScreen(): "login" | "game" {
  if (getSession()) {
    return "game";
  }

  return window.location.hash.slice(1) === "game" ? "game" : "login";
}

export class UiStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  screen: "login" | "game" = getInitialScreen();

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
