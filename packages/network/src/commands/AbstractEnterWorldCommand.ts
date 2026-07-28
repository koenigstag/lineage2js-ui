import { EPacketReceived } from "../events/EventTypes";
import { EventHandler } from "../mmocore/EventEmitter";
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
    // These are handshake-scoped, not session-scoped: leaving them subscribed
    // past the handshake means a second trip into the world (e.g. after
    // CommandRestart) runs each of them once per previous attempt -- duplicate
    // Appearing/ValidatePosition on every teleport, and a stale "LoggedIn"
    // fired against an already-settled promise.
    const subscriptions: Array<[string, EventHandler]> = [];
    const step = (type: string, handler: EventHandler): void => {
      subscriptions.push([type, handler]);
      this.GameClient.once(type, handler);
    };
    const watch = (type: string, handler: EventHandler): void => {
      subscriptions.push([type, handler]);
      this.GameClient.on(type, handler);
    };
    const settle = (): void => {
      for (const [type, handler] of subscriptions) this.GameClient.off(type, handler);
      subscriptions.length = 0;
    };

    // Without this, a server that just closes the socket instead of sending
    // an explicit failure packet would leave this promise hanging forever.
    step("Disconnected", () => {
      settle();
      reject(new Error("Connection closed by server"));
    });

    step("PacketReceived:CharSelected", () => {
      this.GameClient.sendPacket(new RequestManorList())
        .then(() => this.GameClient.sendPacket(new RequestKeyMapping()))
        .then(() => this.GameClient.sendPacket(new EnterWorld()))
        .catch((e) => {
          settle();
          reject("Enter world fail." + e);
        });
    });

    watch("PacketReceived:SystemMessage", (e) => {
      if (((e as EPacketReceived).data.packet as SystemMessage).messageId === WELCOME_TO_LINEAGE_MESSAGE_ID) {
        const result: EnterWorldResult = { login: this.LoginClient, game: this.GameClient };
        settle();
        this.GameClient.fire("LoggedIn", result);
        resolve(result);
      }
    });

    // Unlike the others this one outlives the handshake -- in-world teleports
    // need it for the whole session. Dropping the previous trip's copy first
    // is what keeps it from being registered twice after a restart.
    this.GameClient.off("PacketReceived:TeleportToLocation");
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
