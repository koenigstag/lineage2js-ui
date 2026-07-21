import { EPacketReceived } from "../events/EventTypes";
import L2Character from "../entities/L2Character";
import CharCreateFail from "../network/incoming/game/CharCreateFail";
import CharacterCreate from "../network/outgoing/game/CharacterCreate";
import CharacterSelect from "../network/outgoing/game/CharacterSelect";
import NewCharacter from "../network/outgoing/game/NewCharacter";
import AbstractEnterWorldCommand, { EnterWorldResult } from "./AbstractEnterWorldCommand";

// Third part of the former composite "enter" command, new-character branch:
// create a character in the given slot (its would-be index in the character
// list CommandSelectServer resolved, i.e. the existing character count) and
// enter the world with it.
export default class CommandCreateCharacter extends AbstractEnterWorldCommand {
  execute(charData: L2Character, newCharSlot: number): Promise<EnterWorldResult> {
    return new Promise((resolve, reject) => {
      this.GameClient.once("PacketReceived:NewCharacterSuccess", () =>
        this.GameClient.sendPacket(new CharacterCreate(charData))
      );

      this.GameClient.once("PacketReceived:CharCreateOk", () =>
        this.GameClient.sendPacket(new CharacterSelect(newCharSlot))
      );

      this.GameClient.once("PacketReceived:CharCreateFail", (e: EPacketReceived) =>
        reject((e.data.packet as CharCreateFail).FailReason)
      );

      this.awaitEnterWorld(resolve, reject);

      this.GameClient.sendPacket(new NewCharacter()).catch((e) => reject(e));
    });
  }
}
