import AbstractGameCommand from "./AbstractGameCommand";
import TradeRequest from "../network/outgoing/game/TradeRequest";

export default class CommandRequestTrade extends AbstractGameCommand {
  execute(targetObjectId: number): void {
    this.GameClient.sendPacket(new TradeRequest(targetObjectId));
  }
}
