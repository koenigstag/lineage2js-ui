import { EPacketReceived } from "../events/EventTypes";
import { EventHandler } from "../mmocore/EventEmitter";
import L2Character from "../entities/L2Character";
import L2User from "../entities/L2User";
import CharCreateFail from "../network/incoming/game/CharCreateFail";
import CharSelectionInfo from "../network/incoming/game/CharSelectionInfo";
import CharacterCreate from "../network/outgoing/game/CharacterCreate";
import RequestCharacterSelection from "../network/outgoing/game/RequestCharacterSelection";
import AbstractGameCommand from "./AbstractGameCommand";

// Third part of the former composite "enter" command, new-character branch.
// Creating a character does *not* enter the world -- the real client drops
// back to character selection with the new character preselected, and the
// server agrees: it stays in the char-select state throughout. Resolves with
// the roster that RequestGotoLobby brings back.
//
// Assumes CommandRequestCharacterTemplates already ran when the char-create
// screen was opened -- no need to request them again here.
export default class CommandCreateCharacter extends AbstractGameCommand {
  execute(charData: L2Character): Promise<L2User[]> {
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

      step("PacketReceived:CharCreateFail", (e) => {
        const packet = (e as EPacketReceived).data.packet as CharCreateFail;
        settle();
        reject(packet.FailReason);
      });

      // CharacterCreate only refreshes the roster server-side -- it answers
      // with a bare CharCreateOk and does not push a CharSelectionInfo the way
      // RequestRestart does. Asking for the roster is what actually gets it
      // sent, so waiting on CharCreateOk alone would hang.
      step("PacketReceived:CharCreateOk", () =>
        this.GameClient.sendPacket(new RequestCharacterSelection()).catch((e) => {
          settle();
          reject(e);
        })
      );

      step("PacketReceived:CharSelectionInfo", (e) => {
        const packet = (e as EPacketReceived).data.packet as CharSelectionInfo;
        settle();
        resolve(Array.from(packet.CharacterPackages));
      });

      step("Disconnected", () => {
        settle();
        reject(new Error("Connection closed by server"));
      });

      this.GameClient.sendPacket(new CharacterCreate(charData)).catch((e) => {
        settle();
        reject(e);
      });
    });
  }
}
