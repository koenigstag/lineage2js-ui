import AbstractGameCommand from "./AbstractGameCommand";
import RequestVoteNew from "../network/outgoing/game/RequestVoteNew";

export default class CommandRecommend extends AbstractGameCommand {
  execute(targetObjectId: number): void {
    this.GameClient?.sendPacket(new RequestVoteNew(targetObjectId));
  }
}
