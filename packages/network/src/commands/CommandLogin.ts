import { EPacketReceived } from "../events/EventTypes";
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
  execute(config: MMOConfig | Record<string, unknown>): Promise<LoginResult> {
    const mergedConfig: MMOConfig = { ...new MMOConfig(), ...(config as MMOConfig) };

    return new Promise((resolve, reject) => {
      this.LoginClient.init(mergedConfig);
      this.LoginClient.connect()
        .then(() => {
          this.LoginClient.once("PacketReceived:LoginFail", (e: EPacketReceived) => {
            reject((e.data.packet as LoginFail).FailReason);
          });

          this.LoginClient.once("PacketReceived:Init", () =>
            this.LoginClient.sendPacket(new AuthGameGuard(this.LoginClient.Session.sessionId))
          );

          this.LoginClient.once("PacketReceived:GGAuth", () =>
            this.LoginClient.sendPacket(
              new RequestAuthLogin(mergedConfig.Username, mergedConfig.Password, this.LoginClient.Session)
            )
          );

          this.LoginClient.once("PacketReceived:LoginOk", () =>
            this.LoginClient.sendPacket(new RequestServerList(this.LoginClient.Session))
          );

          this.LoginClient.once("PacketReceived:ServerList", (e: EPacketReceived) => {
            const packet = e.data.packet as ServerList;
            resolve({ servers: packet.Servers, lastServerId: packet.LastServerId });
          });
        })
        .catch((e) => reject(e));
    });
  }
}
