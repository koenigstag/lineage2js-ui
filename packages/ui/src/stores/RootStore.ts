import { SessionStore } from "./SessionStore";
import { UiStore } from "./UiStore";

export class RootStore {
  session = new SessionStore();
  ui = new UiStore();
}

export const rootStore = new RootStore();
