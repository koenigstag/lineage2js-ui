import AbstractGameCommand from "./AbstractGameCommand";
import AnswerTradeRequest from "../network/outgoing/game/AnswerTradeRequest";

export default class CommandAcceptTradeRequest extends AbstractGameCommand {
  execute(): void {
    this.GameClient?.sendPacket(
      new AnswerTradeRequest(AnswerTradeRequest.ANSWER_ACCEPT)
    );
  }
}
