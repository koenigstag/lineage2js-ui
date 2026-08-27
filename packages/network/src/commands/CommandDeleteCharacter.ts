import { EPacketReceived } from "../events/EventTypes";
import { EventHandler } from "../mmocore/EventEmitter";
import L2User from "../entities/L2User";
import CharDeleteFail from "../network/incoming/game/CharDeleteFail";
import CharSelectionInfo from "../network/incoming/game/CharSelectionInfo";
import CharacterDelete from "../network/outgoing/game/CharacterDelete";
import AbstractGameCommand from "./AbstractGameCommand";

/**
 * Deletes one of the account's characters by roster slot index, resolving
 * with the refreshed roster (same shape as selectServer/createCharacter).
 *
 * Deletion is deferred, not immediate: the character comes back in that
 * roster with a DeleteSecondsLeft countdown rather than disappearing, and
 * restoreCharacter cancels it while it runs. Only once the timer expires
 * server-side does the character actually go.
 *
 * Unlike CharacterCreate, the server pushes the new roster by itself after
 * either outcome (its handler ends with sendCharacterSelection whether the
 * delete succeeded or failed), so there is nothing to request -- the refusal
 * is caught first and rejected with its reason, and the roster that follows
 * simply arrives after this command has already settled.
 */
export default class CommandDeleteCharacter extends AbstractGameCommand {
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

      step("PacketReceived:CharDeleteFail", (e) => {
        const packet = (e as EPacketReceived).data.packet as CharDeleteFail;
        settle();
        reject(packet.FailReason);
      });

      step("PacketReceived:CharSelectionInfo", (e) => {
        const packet = (e as EPacketReceived).data.packet as CharSelectionInfo;
        settle();
        resolve(Array.from(packet.CharacterPackages));
      });

      step("Disconnected", () => {
        settle();
        reject(new Error("Connection closed by server"));
      });

      this.GameClient.sendPacket(new CharacterDelete(slotIndex)).catch((e) => {
        settle();
        reject(e);
      });
    });
  }
}
