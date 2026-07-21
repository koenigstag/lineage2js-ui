import { makeAutoObservable } from "mobx";
import {
  Client,
  type L2Character,
  type L2Server,
  type L2User,
  type CharCreateFailReason,
  type LoginFailReason,
  type PlayFailReason,
} from "@lineage2js/network";
import { addKnownAccount, getKnownAccounts, type KnownAccount } from "../lib/session";

export interface Session {
  login: string;
  token: string;
}

const LOGIN_FAIL_MESSAGES: Partial<Record<keyof typeof LoginFailReason, string>> = {
  REASON_USER_OR_PASS_WRONG: "Incorrect username or password.",
  REASON_ACCOUNT_IN_USE: "This account is already logged in.",
  REASON_SERVER_MAINTENANCE: "Server is under maintenance.",
  REASON_ACCESS_FAILED: "Access failed, try again later.",
  REASON_ACCESS_FAILED_TRY_AGAIN_LATER: "Access failed, try again later.",
  REASON_SERVER_OVERLOADED: "Server is overloaded, try again later.",
};

const PLAY_FAIL_MESSAGES: Partial<Record<keyof typeof PlayFailReason, string>> = {
  REASON_SERVER_OVERLOADED: "Server is full, try again later.",
  REASON_SERVER_MAINTENANCE: "Server is under maintenance.",
  REASON_ACCESS_FAILED: "Access failed, try again later.",
  REASON_ACCESS_FAILED_TRY_AGAIN_LATER: "Access failed, try again later.",
};

const CHAR_CREATE_FAIL_MESSAGES: Partial<Record<keyof typeof CharCreateFailReason, string>> = {
  REASON_TOO_MANY_CHARACTERS: "You already have the maximum number of characters.",
  REASON_NAME_ALREADY_EXISTS: "That name is already taken.",
  REASON_16_ENG_CHARS: "Name must be up to 16 English characters.",
  REASON_INCORRECT_NAME: "That name isn't allowed.",
  REASON_CREATE_NOT_ALLOWED: "Character creation isn't allowed right now.",
};

function describeFailure(reason: unknown, messages: Partial<Record<string, string>>, fallback: string): string {
  if (typeof reason === "string") {
    return messages[reason] ?? fallback;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  return fallback;
}

// Owns both the live network connection (Client, servers/characters,
// connect state) and the lightweight local "am I logged in" UI flag --
// merged into one store since they're really two views of the same thing:
// there's no such notion as a local session without a live connection.
export class SessionStore {
  client = new Client();
  servers: L2Server[] = [];
  characters: L2User[] = [];
  isConnecting = false;
  error: string | undefined = undefined;

  session: Session | undefined = undefined;
  knownAccounts: KnownAccount[] = getKnownAccounts();

  constructor() {
    makeAutoObservable(this, { client: false });
    window.addEventListener("beforeunload", () => this.logout());
  }

  get isAuthenticated(): boolean {
    return this.session !== undefined;
  }

  async login(username: string, password: string): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const { servers } = await this.client.login({
        Username: username,
        Password: password,
        Ip: import.meta.env.VITE_LOGIN_SERVER_IP || "127.0.0.1",
        Port: Number(import.meta.env.VITE_LOGIN_SERVER_PORT) || 2106,
        Stream: "websocket",
      });
      this.servers = servers;

      addKnownAccount(username);
      this.knownAccounts = getKnownAccounts();
      this.session = { login: username, token: crypto.randomUUID() };

      return true;
    } catch (reason) {
      this.error = describeFailure(reason, LOGIN_FAIL_MESSAGES, "Login failed.");
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  async selectServer(serverId: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      this.characters = await this.client.selectServer(serverId);
      return true;
    } catch (reason) {
      this.error = describeFailure(reason, PLAY_FAIL_MESSAGES, "Could not connect to that server.");
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  async selectCharacter(slotIndex: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      await this.client.selectCharacter(slotIndex);
      return true;
    } catch (reason) {
      this.error = describeFailure(reason, {}, "Could not enter the world.");
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  async createCharacter(charData: L2Character, newCharSlot: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      await this.client.createCharacter(charData, newCharSlot);
      return true;
    } catch (reason) {
      this.error = describeFailure(reason, CHAR_CREATE_FAIL_MESSAGES, "Could not create character.");
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  /** Leaves the game/login server entirely and clears the local session (e.g. re-login, browser close). */
  logout(): void {
    if (this.client.GameClient.IsConnected) {
      // Best-effort graceful notice -- the socket gets closed right after regardless.
      this.client.logout();
    }

    this.client.LoginClient.Connection?.close();
    this.client.GameClient.Connection?.close();

    this.servers = [];
    this.characters = [];
    this.error = undefined;
    this.isConnecting = false;
    this.session = undefined;
  }
}
