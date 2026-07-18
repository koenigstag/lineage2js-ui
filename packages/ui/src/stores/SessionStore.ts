import { makeAutoObservable } from "mobx";
import {
  addKnownAccount,
  clearSession,
  getKnownAccounts,
  getSession,
  setSession,
  type KnownAccount,
  type Session,
} from "../lib/session";

export class SessionStore {
  session: Session | undefined = getSession();
  knownAccounts: KnownAccount[] = getKnownAccounts();

  constructor() {
    makeAutoObservable(this);
  }

  get isAuthenticated(): boolean {
    return this.session !== undefined;
  }

  login(login: string, token: string) {
    addKnownAccount(login);
    this.knownAccounts = getKnownAccounts();

    const session = { login, token };
    setSession(session);
    this.session = session;
  }

  logout() {
    clearSession();
    this.session = undefined;
  }
}
