import { EPacketReceived } from "../events/EventTypes";
import RequestNewCharacterSuccess, { CharacterTemplate } from "../network/incoming/game/RequestNewCharacterSuccess";
import RequestNewCharacter from "../network/outgoing/game/RequestNewCharacter";
import AbstractGameCommand from "./AbstractGameCommand";

// Matches the real client: RequestNewCharacter is sent when the player opens
// the character-creation screen (not at the point of submitting the form),
// so the templates are already available to show base stats before the
// character is actually created (see CommandCreateCharacter).
export default class CommandRequestCharacterTemplates extends AbstractGameCommand {
  execute(): Promise<CharacterTemplate[]> {
    return new Promise((resolve, reject) => {
      this.GameClient.once("PacketReceived:RequestNewCharacterSuccess", (e: EPacketReceived) => {
        resolve((e.data.packet as RequestNewCharacterSuccess).Templates);
      });

      this.GameClient.sendPacket(new RequestNewCharacter()).catch((e) => reject(e));
    });
  }
}
