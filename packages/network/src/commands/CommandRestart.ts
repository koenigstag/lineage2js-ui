import { EPacketReceived } from "../events/EventTypes";
import { EventHandler } from "../mmocore/EventEmitter";
import L2User from "../entities/L2User";
import CharSelectionInfo from "../network/incoming/game/CharSelectionInfo";
import RestartResponse from "../network/incoming/game/RestartResponse";
import RequestRestart from "../network/outgoing/game/RequestRestart";
import AbstractGameCommand from "./AbstractGameCommand";

// Leaves the world and goes back to character selection without dropping the
// game-server connection -- the counterpart of CommandSelectCharacter. The
// server answers RequestRestart with RestartResponse and, on success, follows
// it with a fresh CharSelectionInfo, i.e. the same roster packet that
// CommandSelectServer resolves with.
//
// Skipping this and merely switching the UI back to the char-select screen
// leaves the server believing the character is still in the world, which makes
// every subsequent char-select-state request (RequestNewCharacter above all)
// go unanswered.
export default class CommandRestart extends AbstractGameCommand {
  execute(): Promise<L2User[]> {
    return new Promise((resolve, reject) => {
      const subscriptions: Array<[string, EventHandler]> = [];
      const step = (type: string, handler: EventHandler): void => {
        subscriptions.push([type, handler]);
        this.GameClient.once(type, handler);
      };
      const settle = (): void => {
        for (const [type, handler] of subscriptions) this.GameClient.off(type, handler);
        subscriptions.length = 0;
      };

      step("PacketReceived:RestartResponse", (e) => {
        if ((e as EPacketReceived).data.packet instanceof RestartResponse) {
          const packet = (e as EPacketReceived).data.packet as RestartResponse;
          if (packet.Result === 0) {
            settle();
            reject(new Error("Server refused the restart request"));
          }
        }
      });

      step("PacketReceived:CharSelectionInfo", (e) => {
        const packet = (e as EPacketReceived).data.packet as CharSelectionInfo;
        settle();
        // The in-world state belongs to the character we just left -- keep it
        // out of the next EnterWorld's way.
        this.GameClient.resetWorldState();
        resolve(Array.from(packet.CharacterPackages));
      });

      step("Disconnected", () => {
        settle();
        reject(new Error("Connection closed by server"));
      });

      this.GameClient.sendPacket(new RequestRestart()).catch((e) => {
        settle();
        reject(e);
      });
    });
  }
}
