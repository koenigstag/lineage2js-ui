import AbstractGameCommand from "./AbstractGameCommand";
import RequestNetPing from "../network/outgoing/game/RequestNetPing";

export default class CommandNetPing extends AbstractGameCommand {
  execute(): void {
    this.GameClient?.sendPacket(new RequestNetPing());
  }
}
