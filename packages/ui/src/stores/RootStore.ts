import { SessionStore } from "./SessionStore";
import { UiStore } from "./UiStore";
import { DatapackStore } from "./DatapackStore";
import { GameStore } from "./GameStore";
import { WindowManagerStore } from "./WindowManagerStore";

export class RootStore {
  session = new SessionStore();
  ui = new UiStore();
  datapack = new DatapackStore();
  game = new GameStore();
  windowManager = new WindowManagerStore();

  constructor() {
    this.game.bindToClient(this.session.client);
  }
}

export const rootStore = new RootStore();

// Console access (window.__rootStore) for manual verification, in production
// builds as well as dev: a bug that only shows up against a real server can
// only be looked at on the deployed client, and without this there is nothing
// to look at -- the state lives in closures the console can't reach.
//
// Nothing secret is handed out by it. The password is an argument to
// SessionStore.login(), never a field, and everything the store does hold is
// state this client received or typed itself. It does make the client easy to
// drive from the console, which is a cheating surface only in the sense that
// any client already is one: the server stays authoritative, and this saves
// nobody the trouble who was determined to try.
(window as unknown as { __rootStore: RootStore }).__rootStore = rootStore;
