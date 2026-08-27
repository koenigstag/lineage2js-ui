import { EPacketReceived } from "../events/EventTypes";
import L2User from "../entities/L2User";
import MMOConfig from "../mmocore/MMOConfig";
import CharSelectionInfo from "../network/incoming/game/CharSelectionInfo";
import KeyPacket from "../network/incoming/game/KeyPacket";
import PlayFail from "../network/incoming/login/PlayFail";
import AuthLogin from "../network/outgoing/game/AuthLogin";
import ProtocolVersion, { GAME_PROTOCOL_VERSION } from "../network/outgoing/game/ProtocolVersion";
import RequestServerLogin from "../network/outgoing/login/RequestServerLogin";
import AbstractGameCommand from "./AbstractGameCommand";

// Second part of the former composite "enter" command: pick one of the
// servers from CommandLogin's result, log into it, and hand off to the game
// server. Resolves with the account's existing characters on that server.
export default class CommandSelectServer extends AbstractGameCommand {
  static requiresGameConnection = false;

  execute(serverId: number): Promise<L2User[]> {
    return new Promise((resolve, reject) => {
      const server = this.LoginClient.Servers.find((s) => s.Id === serverId);
      if (!server) {
        reject(new Error(`Unknown serverId: ${serverId}`));
        return;
      }

      // ServerListMutator eagerly guesses a server for Session.server -- override
      // it with whatever the caller actually picked.
      this.LoginClient.Session.server = {
        host: server.resolveHost(this.LoginClient.Config.Secure, this.LoginClient.Config.Ip),
        port: server.Port,
      };

      this.LoginClient.once("PacketReceived:PlayFail", (e: EPacketReceived) => {
        reject((e.data.packet as PlayFail).FailReason);
      });

      // Some servers just close the socket instead of sending PlayFail (e.g.
      // "already in game") -- without this the promise would hang forever.
      // Harmless once PlayOk's own success path closes this connection on
      // purpose: by then this handler has already been cleared via offAll().
      this.LoginClient.once("Disconnected", () => reject(new Error("Connection closed by server")));

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

      // Without this, a game server that just closes the socket instead of
      // sending an explicit failure (e.g. no CharSelectionInfo after
      // AuthLogin) would leave this promise hanging forever.
      this.GameClient.once("Disconnected", () => reject(new Error("Connection closed by server")));

      // KeyPacket is the protocol version verdict as well as the crypt key
      // (see that packet). A refusal is followed immediately by the server
      // closing the socket, so without this the Disconnected handler above
      // would win the race and report a generic "connection closed" for what
      // is really a version mismatch -- the single most likely reason a real
      // server turns this client away.
      this.GameClient.once("PacketReceived:KeyPacket", (e: EPacketReceived) => {
        const packet = e.data.packet as KeyPacket;
        if (!packet.IsProtocolOk) {
          reject(
            new Error(
              `Server refused protocol version ${GAME_PROTOCOL_VERSION} -- it expects a different Lineage 2 client version.`
            )
          );
          return;
        }
        this.GameClient.sendPacket(new AuthLogin(this.GameClient.Session));
      });

      this.GameClient.once("PacketReceived:CharSelectionInfo", (e: EPacketReceived) => {
        const packet = e.data.packet as CharSelectionInfo;
        resolve(Array.from(packet.CharacterPackages));
      });

      this.LoginClient.sendPacket(new RequestServerLogin(this.LoginClient.Session, serverId));
    });
  }
}
