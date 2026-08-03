import AbstractGameCommand from "./AbstractGameCommand";
import RequestChangePartyLeader from "../network/outgoing/game/RequestChangePartyLeader";

export default class CommandChangePartyLeader extends AbstractGameCommand {
  execute(name: string): void {
    this.GameClient.sendPacket(new RequestChangePartyLeader(name));
  }
}
