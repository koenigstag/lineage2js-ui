import { SessionStore } from "./SessionStore";
import { UiStore } from "./UiStore";
import { GameStore } from "./GameStore";
import { WindowManagerStore } from "./WindowManagerStore";

export class RootStore {
  session = new SessionStore();
  ui = new UiStore();
  game = new GameStore();
  windowManager = new WindowManagerStore();
}

export const rootStore = new RootStore();
