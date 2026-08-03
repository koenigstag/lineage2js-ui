import AbstractGameCommand from "./AbstractGameCommand";
import RequestWithDrawalParty from "../network/outgoing/game/RequestWithDrawalParty";

export default class CommandLeaveParty extends AbstractGameCommand {
  execute(): void {
    this.GameClient.sendPacket(new RequestWithDrawalParty());
  }
}
