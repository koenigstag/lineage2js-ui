import { SessionStore } from "./SessionStore";
import { UiStore } from "./UiStore";
import { GameStore } from "./GameStore";
import { WindowManagerStore } from "./WindowManagerStore";

export class RootStore {
  session = new SessionStore();
  ui = new UiStore();
  game = new GameStore();
  windowManager = new WindowManagerStore();

  constructor() {
    this.game.bindToClient(this.session.client);
  }
}

export const rootStore = new RootStore();

// Dev-only console access (window.__rootStore) for manual browser verification.
if (import.meta.env.DEV) {
  (window as unknown as { __rootStore: RootStore }).__rootStore = rootStore;
}
