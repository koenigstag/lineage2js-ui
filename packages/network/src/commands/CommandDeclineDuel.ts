import AbstractGameCommand from "./AbstractGameCommand";
import RequestDuelAnswerStart from "../network/outgoing/game/RequestDuelAnswerStart";

export default class CommandDeclineDuel extends AbstractGameCommand {
  execute(): void {
    this.GameClient.sendPacket(
      new RequestDuelAnswerStart(
        this.GameClient.LastDuelPartyDuel,
        RequestDuelAnswerStart.ANSWER_DECLINE
      )
    );
  }
}
