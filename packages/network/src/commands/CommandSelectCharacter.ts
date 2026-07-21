import CharacterSelect from "../network/outgoing/game/CharacterSelect";
import AbstractEnterWorldCommand, { EnterWorldResult } from "./AbstractEnterWorldCommand";

// Third part of the former composite "enter" command, existing-character
// branch: select one of the characters resolved by CommandSelectServer (by
// its index in that list) and enter the world with it.
export default class CommandSelectCharacter extends AbstractEnterWorldCommand {
  execute(slotIndex: number): Promise<EnterWorldResult> {
    return new Promise((resolve, reject) => {
      this.awaitEnterWorld(resolve, reject);

      this.GameClient.sendPacket(new CharacterSelect(slotIndex)).catch((e) => reject(e));
    });
  }
}
