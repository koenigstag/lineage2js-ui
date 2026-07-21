import { EPacketReceived } from "../events/EventTypes";
import L2User from "../entities/L2User";
import MMOConfig from "../mmocore/MMOConfig";
import CharSelectionInfo from "../network/incoming/game/CharSelectionInfo";
import PlayFail from "../network/incoming/login/PlayFail";
import AuthLogin from "../network/outgoing/game/AuthLogin";
import ProtocolVersion from "../network/outgoing/game/ProtocolVersion";
import RequestServerLogin from "../network/outgoing/login/RequestServerLogin";
import AbstractGameCommand from "./AbstractGameCommand";

// Second part of the former composite "enter" command: pick one of the
// servers from CommandLogin's result, log into it, and hand off to the game
// server. Resolves with the account's existing characters on that server.
export default class CommandSelectServer extends AbstractGameCommand {
  execute(serverId: number): Promise<L2User[]> {
    return new Promise((resolve, reject) => {
      const server = this.LoginClient.Servers.find((s) => s.Id === serverId);
      if (!server) {
        reject(new Error(`Unknown serverId: ${serverId}`));
        return;
      }

      // ServerListMutator eagerly guesses a server for Session.server -- override
      // it with whatever the caller actually picked.
      this.LoginClient.Session.server = { host: server.Ipv4(), port: server.Port };

      this.LoginClient.once("PacketReceived:PlayFail", (e: EPacketReceived) => {
        reject((e.data.packet as PlayFail).FailReason);
      });

      this.LoginClient.once("PacketReceived:PlayOk", () => {
        setTimeout(() => {
          this.LoginClient.Connection.close();
          this.LoginClient.offAll();
        }, 0);

        const gameConfig: MMOConfig = {
          ...this.LoginClient.Config,
          Ip: this.LoginClient.Session.server.host,
          Port: this.LoginClient.Session.server.port,
        };

        this.GameClient.Session = this.LoginClient.Session;
        this.GameClient.init(gameConfig);
        this.GameClient.connect()
          .then(() => this.GameClient.sendPacket(new ProtocolVersion()))
          .catch((e) => reject(e));
      });

      this.GameClient.once("PacketReceived:KeyPacket", () =>
        this.GameClient.sendPacket(new AuthLogin(this.GameClient.Session))
      );

      this.GameClient.once("PacketReceived:CharSelectionInfo", (e: EPacketReceived) => {
        const packet = e.data.packet as CharSelectionInfo;
        resolve(Array.from(packet.CharacterPackages));
      });

      this.LoginClient.sendPacket(new RequestServerLogin(this.LoginClient.Session, serverId));
    });
  }
}
