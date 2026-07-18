import { makeAutoObservable } from "mobx";
import { getSession } from "../lib/session";

function getInitialScreen(): "login" | "game" {
  if (getSession()) {
    return "game";
  }

  return window.location.hash.slice(1) === "game" ? "game" : "login";
}

export class RootStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  screen: "login" | "game" = getInitialScreen();

  constructor() {
    makeAutoObservable(this);
  }

  setConnectionStatus(status: RootStore["connectionStatus"]) {
    this.connectionStatus = status;
  }

  setScreen(screen: RootStore["screen"]) {
    this.screen = screen;
  }
}

export const rootStore = new RootStore();
