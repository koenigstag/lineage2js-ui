import AbstractGameCommand from "./AbstractGameCommand";
import RequestDestroyItem from "../network/outgoing/game/RequestDestroyItem";

export default class CommandDestroyItem extends AbstractGameCommand {
  execute(objectId: number, count: number): void {
    this.GameClient?.sendPacket(new RequestDestroyItem(objectId, count));
  }
}
