import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import Logger from "../../../mmocore/Logger";
import GameClient from "../../GameClient";
import GameGuardQuery from "../../incoming/game/GameGuardQuery";
import GameGuardReply from "../../outgoing/game/GameGuardReply";
import { gameGuardResponse, toHexString } from "../../gameguard";

/**
 * Answers the server's GameGuard challenge as soon as it arrives.
 *
 * Replying from the mutator (rather than from a command step, the way the
 * KeyPacket handshake is driven) because this challenge isn't tied to one
 * point in the login flow -- the server can ask whenever it likes, and every
 * ask needs an answer. Same shape as StopMoveMutator's own ValidatePosition
 * reply.
 *
 * A challenge with no known answer gets no reply at all. The server checks
 * the response by hash, so a guess is rejected exactly like silence -- but
 * unlike silence it would put bytes on the wire claiming to be an answer, and
 * leave nothing behind explaining why verification never succeeded. The
 * warning names the challenge, which is what someone would need to add it to
 * gameguard.ts.
 */
const logger = Logger.getLogger("GameGuardQueryMutator");

export default class GameGuardQueryMutator extends IMMOClientMutator<GameClient, GameGuardQuery> {
  update(packet: GameGuardQuery): void {
    const response = gameGuardResponse(packet.Challenge);
    if (!response) {
      logger.warn(
        `Unknown GameGuard challenge ${toHexString(packet.Challenge)} -- not replying. ` +
          `This connection stays GameGuard-unverified; add the challenge and its response to gameguard.ts if a real client's answer is known.`
      );
      return;
    }

    this.Client.sendPacket(new GameGuardReply(response));
  }
}
