import { EPacketReceived } from "../events/EventTypes";
import { EventHandler } from "../mmocore/EventEmitter";
import L2User from "../entities/L2User";
import CharSelectionInfo from "../network/incoming/game/CharSelectionInfo";
import CharacterRestore from "../network/outgoing/game/CharacterRestore";
import AbstractGameCommand from "./AbstractGameCommand";

/**
 * Cancels a character's pending deletion by roster slot index, resolving with
 * the refreshed roster -- in which that character's DeleteSecondsLeft is back
 * to zero.
 *
 * There is no success or failure packet for restore, unlike delete: the
 * server's handler simply ends with sendCharacterSelection, so the new roster
 * is the whole answer. A restore the server declines (its event listeners can
 * terminate it) sends nothing at all and this waits until the connection
 * drops -- nothing better is available to wait on, and the reference server
 * ships no such listener.
 */
export default class CommandRestoreCharacter extends AbstractGameCommand {
  execute(slotIndex: number): Promise<L2User[]> {
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

      step("PacketReceived:CharSelectionInfo", (e) => {
        const packet = (e as EPacketReceived).data.packet as CharSelectionInfo;
        settle();
        resolve(Array.from(packet.CharacterPackages));
      });

      step("Disconnected", () => {
        settle();
        reject(new Error("Connection closed by server"));
      });

      this.GameClient.sendPacket(new CharacterRestore(slotIndex)).catch((e) => {
        settle();
        reject(e);
      });
    });
  }
}
