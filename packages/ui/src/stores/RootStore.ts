import { SessionStore } from "./SessionStore";
import { UiStore } from "./UiStore";
import { GameStore } from "./GameStore";

export class RootStore {
  session = new SessionStore();
  ui = new UiStore();
  game = new GameStore();
}

export const rootStore = new RootStore();
