import AbstractGameCommand from "./AbstractGameCommand";
import RequestUnEquipItem from "../network/outgoing/game/RequestUnEquipItem";

export default class CommandUnEquipItem extends AbstractGameCommand {
  execute(slot: number): void {
    this.GameClient?.sendPacket(new RequestUnEquipItem(slot));
  }
}
