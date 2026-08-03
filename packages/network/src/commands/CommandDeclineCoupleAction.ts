import AbstractGameCommand from "./AbstractGameCommand";
import AnswerCoupleAction from "../network/outgoing/game/AnswerCoupleAction";

export default class CommandDeclineCoupleAction extends AbstractGameCommand {
  execute(): void {
    this.GameClient.sendPacket(
      new AnswerCoupleAction(
        this.GameClient.LastCoupleActionId,
        AnswerCoupleAction.ANSWER_DECLINE,
        this.GameClient.LastCoupleActionRequesterId
      )
    );
  }
}
