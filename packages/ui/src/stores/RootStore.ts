import { makeAutoObservable } from "mobx";

export class RootStore {
  connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

  constructor() {
    makeAutoObservable(this);
  }

  setConnectionStatus(status: RootStore["connectionStatus"]) {
    this.connectionStatus = status;
  }
}

export const rootStore = new RootStore();
