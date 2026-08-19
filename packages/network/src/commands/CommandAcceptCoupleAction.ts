import AbstractGameCommand from "./AbstractGameCommand";
import AnswerCoupleAction from "../network/outgoing/game/AnswerCoupleAction";

export default class CommandAcceptCoupleAction extends AbstractGameCommand {
  execute(): void {
    this.GameClient.sendPacket(
      new AnswerCoupleAction(
        this.GameClient.LastCoupleActionId,
        AnswerCoupleAction.ANSWER_ACCEPT,
        this.GameClient.LastCoupleActionRequesterId
      )
    );
  }
}
