import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import GameGuardQuery from "../../incoming/game/GameGuardQuery";
import GameGuardReply from "../../outgoing/game/GameGuardReply";
import { gameGuardResponse } from "../../gameguard";

/**
 * Answers the server's GameGuard challenge as soon as it arrives.
 *
 * Replying from the mutator (rather than from a command step, the way the
 * KeyPacket handshake is driven) because this challenge isn't tied to one
 * point in the login flow -- the server can ask whenever it likes, and every
 * ask needs an answer. Same shape as StopMoveMutator's own ValidatePosition
 * reply.
 */
export default class GameGuardQueryMutator extends IMMOClientMutator<GameClient, GameGuardQuery> {
  update(packet: GameGuardQuery): void {
    this.Client.sendPacket(new GameGuardReply(gameGuardResponse(packet.Challenge)));
  }
}
