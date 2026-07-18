import { makeAutoObservable } from "mobx";

export class RootStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  screen: "login" | "game" = "login";

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
