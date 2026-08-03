import { EPacketReceived } from "../events/EventTypes";
import { EventHandler } from "../mmocore/EventEmitter";
import L2Server from "../entities/L2Server";
import MMOConfig from "../mmocore/MMOConfig";
import LoginFail from "../network/incoming/login/LoginFail";
import ServerList from "../network/incoming/login/ServerList";
import AuthGameGuard from "../network/outgoing/login/AuthGameGuard";
import RequestAuthLogin from "../network/outgoing/login/RequestAuthLogin";
import RequestServerList from "../network/outgoing/login/RequestServerList";
import AbstractGameCommand from "./AbstractGameCommand";

export interface LoginResult {
  servers: L2Server[];
  lastServerId: number;
}

// First part of the former composite "enter" command: authenticate against
// the login server and resolve with its server list, without touching the
// game server at all. Meant for a login form -- server choice is a separate
// step (see CommandSelectServer).
export default class CommandLogin extends AbstractGameCommand {
  static requiresConnection = false;

  execute(config: MMOConfig | Record<string, unknown>): Promise<LoginResult> {
    const mergedConfig: MMOConfig = { ...new MMOConfig(), ...(config as MMOConfig) };

    return new Promise((resolve, reject) => {
      this.LoginClient.init(mergedConfig);

      // Subscribe *before* connecting. MMOConnection.connect() starts its read
      // loop as part of resolving, so a server that has Init waiting the moment
      // the socket opens gets it dispatched from a microtask that runs ahead of
      // this promise's own .then() -- subscribing there would miss the packet
      // outright and hang the whole login.
      //
      // A failed attempt (wrong password, ...) also leaves the steps it never
      // reached still subscribed. Track them so the losing branches get torn
      // down too, otherwise the next login on this same Client would run every
      // later step twice -- two RequestServerList for one LoginOk, and so on.
      const subscriptions: Array<[string, EventHandler]> = [];
      const step = (type: string, handler: EventHandler): void => {
        subscriptions.push([type, handler]);
        this.LoginClient.once(type, handler);
      };
      const settle = (): void => {
        for (const [type, handler] of subscriptions) this.LoginClient.off(type, handler);
        subscriptions.length = 0;
      };

      step("PacketReceived:LoginFail", (e) => {
        const packet = (e as EPacketReceived).data.packet as LoginFail;
        settle();
        reject(packet.FailReason);
      });

      // Some servers just close the socket instead of sending LoginFail
      // (e.g. "account in use") -- without this the promise would hang
      // forever instead of surfacing a failure.
      step("Disconnected", () => {
        settle();
        reject(new Error("Connection closed by server"));
      });

      // A step that can't even send its packet (e.g. an account name too long
      // for RequestAuthLogin) has to end the login, not leave it waiting on a
      // reply that will never come.
      const fail = (reason: unknown): void => {
        settle();
        reject(reason);
      };

      step("PacketReceived:Init", () =>
        this.LoginClient.sendPacket(new AuthGameGuard(this.LoginClient.Session.sessionId)).catch(fail)
      );

      step("PacketReceived:GGAuth", () =>
        this.LoginClient.sendPacket(
          new RequestAuthLogin(mergedConfig.Username, mergedConfig.Password, this.LoginClient.Session)
        ).catch(fail)
      );

      step("PacketReceived:LoginOk", () =>
        this.LoginClient.sendPacket(new RequestServerList(this.LoginClient.Session)).catch(fail)
      );

      step("PacketReceived:ServerList", (e) => {
        const packet = (e as EPacketReceived).data.packet as ServerList;
        settle();
        resolve({ servers: packet.Servers, lastServerId: packet.LastServerId });
      });

      this.LoginClient.connect().catch((e) => {
        settle();
        reject(e);
      });
    });
  }
}
