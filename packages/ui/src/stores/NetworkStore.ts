import { makeAutoObservable } from "mobx";
import { Client, type L2Server, type L2User, type LoginFailReason, type PlayFailReason } from "@lineage2js/network";

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

function describeFailure(reason: unknown, messages: Partial<Record<string, string>>, fallback: string): string {
  if (typeof reason === "string") {
    return messages[reason] ?? fallback;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  return fallback;
}

export class NetworkStore {
  client = new Client();
  servers: L2Server[] = [];
  characters: L2User[] = [];
  isConnecting = false;
  error: string | undefined = undefined;

  constructor() {
    makeAutoObservable(this, { client: false });
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
}
