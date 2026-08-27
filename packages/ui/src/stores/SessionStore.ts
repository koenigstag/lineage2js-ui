import { makeAutoObservable, runInAction } from "mobx";
import {
  Client,
  pingGameServer,
  type CharacterTemplate,
  type L2Character,
  type L2Server,
  type L2User,
  type CharCreateFailReason,
  type CharDeleteFailReason,
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

const CHAR_DELETE_FAIL_MESSAGES: Partial<Record<keyof typeof CharDeleteFailReason, string>> = {
  REASON_YOU_MAY_NOT_DELETE_CLAN_MEMBER: "You can't delete a character who is in a clan.",
  REASON_CLAN_LEADERS_MAY_NOT_BE_DELETED: "A clan leader can't be deleted. Disband the clan or hand it over first.",
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
  characterTemplates: CharacterTemplate[] = [];
  /** Round-trip ms per server Id, undefined while pinging, null if unreachable. */
  serverPings: Record<number, number | null | undefined> = {};
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
        Secure: import.meta.env.VITE_LOGIN_SERVER_SECURE === "true",
        Stream: "websocket",
      });
      addKnownAccount(username);

      // Everything past the first await runs outside the action this method
      // started as, so each assignment needs its own -- otherwise strict mode
      // warns and the updates aren't batched into a single reaction.
      runInAction(() => {
        this.servers = servers;
        this.knownAccounts = getKnownAccounts();
        this.session = { login: username, token: crypto.randomUUID() };
      });

      this.pingServers();

      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, LOGIN_FAIL_MESSAGES, "Login failed.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  /**
   * Pings every listed server in the background (not awaited by login()) --
   * see @lineage2js/network's pingGameServer for how, since the login
   * protocol itself has no ping field.
   */
  pingServers(): void {
    for (const server of this.servers) {
      const id = server.Id;
      this.serverPings[id] = undefined;

      pingGameServer(server.Ipv4(), server.Port).then(
        (ms) => runInAction(() => { this.serverPings[id] = ms; }),
        () => runInAction(() => { this.serverPings[id] = null; })
      );
    }
  }

  async selectServer(serverId: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const characters = await this.client.selectServer(serverId);
      runInAction(() => {
        this.characters = characters;
      });
      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, PLAY_FAIL_MESSAGES, "Could not connect to that server.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  async selectCharacter(slotIndex: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      await this.client.selectCharacter(slotIndex);
      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, {}, "Could not enter the world.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  /** Sent when opening the char-create screen -- matches the real client (see CommandRequestCharacterTemplates). */
  async requestCharacterTemplates(): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const templates = await this.client.requestCharacterTemplates();
      runInAction(() => {
        this.characterTemplates = templates;
      });
      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, {}, "Could not load character templates.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  /**
   * Creates the character and refreshes the roster from the server's reply.
   * Resolves with the new character's ObjectId (so the caller can preselect
   * it on the char-select screen) or undefined on failure -- creation does
   * not enter the world, see CommandCreateCharacter.
   */
  async createCharacter(charData: L2Character): Promise<number | undefined> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const characters = await this.client.createCharacter(charData);
      runInAction(() => {
        this.characters = characters;
      });
      return characters.find((character) => character.Name === charData.Name)?.ObjectId;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, CHAR_CREATE_FAIL_MESSAGES, "Could not create character.");
      });
      return undefined;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  /**
   * Starts deleting a character by roster slot, and refreshes the roster from
   * the server's reply. Deferred, not immediate -- the character stays in the
   * roster with DeleteSecondsLeft counting down, and restoreCharacter cancels
   * it until it runs out (see CommandDeleteCharacter).
   */
  async deleteCharacter(slotIndex: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const characters = await this.client.deleteCharacter(slotIndex);
      runInAction(() => {
        this.characters = characters;
      });
      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, CHAR_DELETE_FAIL_MESSAGES, "Could not delete that character.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  /** Cancels a pending deletion by roster slot, and refreshes the roster. */
  async restoreCharacter(slotIndex: number): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const characters = await this.client.restoreCharacter(slotIndex);
      runInAction(() => {
        this.characters = characters;
      });
      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, {}, "Could not restore that character.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
    }
  }

  /**
   * Leaves the world back to character selection, keeping the game-server
   * connection. Without this the server still considers the character to be
   * in-world and silently ignores every char-select-state request that follows.
   */
  async restart(): Promise<boolean> {
    this.isConnecting = true;
    this.error = undefined;

    try {
      const characters = await this.client.restart();
      runInAction(() => {
        this.characters = characters;
      });
      return true;
    } catch (reason) {
      runInAction(() => {
        this.error = describeFailure(reason, {}, "Could not return to character selection.");
      });
      return false;
    } finally {
      runInAction(() => {
        this.isConnecting = false;
      });
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
    this.characterTemplates = [];
    this.serverPings = {};
    this.error = undefined;
    this.isConnecting = false;
    this.session = undefined;
  }
}
