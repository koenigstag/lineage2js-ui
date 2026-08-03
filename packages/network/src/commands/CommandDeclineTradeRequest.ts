import AbstractGameCommand from "./AbstractGameCommand";
import AnswerTradeRequest from "../network/outgoing/game/AnswerTradeRequest";

export default class CommandDeclineTradeRequest extends AbstractGameCommand {
  execute(): void {
    this.GameClient.sendPacket(
      new AnswerTradeRequest(AnswerTradeRequest.ANSWER_DECLINE)
    );
  }
}
