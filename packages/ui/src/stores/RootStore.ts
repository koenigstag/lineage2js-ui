import { SessionStore } from "./SessionStore";
import { UiStore } from "./UiStore";
import { GameStore } from "./GameStore";
import { NetworkStore } from "./NetworkStore";
import { WindowManagerStore } from "./WindowManagerStore";

export class RootStore {
  session = new SessionStore();
  ui = new UiStore();
  game = new GameStore();
  network = new NetworkStore();
  windowManager = new WindowManagerStore();
}

export const rootStore = new RootStore();
