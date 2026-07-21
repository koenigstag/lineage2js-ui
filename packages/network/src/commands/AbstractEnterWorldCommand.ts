import { EPacketReceived } from "../events/EventTypes";
import LoginClient from "../network/LoginClient";
import GameClient from "../network/GameClient";
import SystemMessage from "../network/incoming/game/SystemMessage";
import Appearing from "../network/outgoing/game/Appearing";
import EnterWorld from "../network/outgoing/game/EnterWorld";
import RequestKeyMapping from "../network/outgoing/game/RequestKeyMapping";
import RequestManorList from "../network/outgoing/game/RequestManorList";
import ValidatePosition from "../network/outgoing/game/ValidatePosition";
import AbstractGameCommand from "./AbstractGameCommand";

const WELCOME_TO_LINEAGE_MESSAGE_ID = 34;

// A type alias (not interface) here so it's structurally assignable to
// EventEmitter.fire()'s Record<string, unknown> data parameter.
export type EnterWorldResult = {
  login: LoginClient;
  game: GameClient;
};

// Shared tail of the character-select/character-create commands: once a
// character slot has been selected server-side, both flows finish identically
// (CharSelected -> ManorList/KeyMapping/EnterWorld -> WELCOME_TO_LINEAGE).
export default abstract class AbstractEnterWorldCommand extends AbstractGameCommand {
  protected awaitEnterWorld(resolve: (result: EnterWorldResult) => void, reject: (reason: unknown) => void): void {
    // Without this, a server that just closes the socket instead of sending
    // an explicit failure packet would leave this promise hanging forever.
    this.GameClient.once("Disconnected", () => reject(new Error("Connection closed by server")));

    this.GameClient.once("PacketReceived:CharSelected", () => {
      this.GameClient.sendPacket(new RequestManorList())
        .then(() => this.GameClient.sendPacket(new RequestKeyMapping()))
        .then(() => this.GameClient.sendPacket(new EnterWorld()))
        .catch((e) => reject("Enter world fail." + e));
    });

    this.GameClient.on("PacketReceived:SystemMessage", (e: EPacketReceived) => {
      if ((e.data.packet as SystemMessage).messageId === WELCOME_TO_LINEAGE_MESSAGE_ID) {
        const result: EnterWorldResult = { login: this.LoginClient, game: this.GameClient };
        this.GameClient.fire("LoggedIn", result);
        resolve(result);
      }
    });

    this.GameClient.on("PacketReceived:TeleportToLocation", () => {
      this.GameClient.sendPacket(new Appearing());
      this.GameClient.sendPacket(
        new ValidatePosition(
          this.GameClient.ActiveChar.X,
          this.GameClient.ActiveChar.Y,
          this.GameClient.ActiveChar.Z,
          this.GameClient.ActiveChar.Heading,
          0
        )
      );
    });
  }
}
