import AbstractGameCommand from "./AbstractGameCommand";
import RequestOustPartyMember from "../network/outgoing/game/RequestOustPartyMember";

export default class CommandDismissPartyMember extends AbstractGameCommand {
  execute(name: string): void {
    this.GameClient.sendPacket(new RequestOustPartyMember(name));
  }
}
