import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ChangeWaitType from "../../incoming/game/ChangeWaitType";
import L2Character from "../../../entities/L2Character";

// MoveType values, per the wire: 0 sitting, 1 standing, 2 start fake dead,
// 3 stop fake dead.
const SITTING = 0;
const START_FAKE_DEATH = 2;

export default class ChangeWaitTypeMutator extends IMMOClientMutator<GameClient, ChangeWaitType> {
  update(packet: ChangeWaitType): void {
    const creature = this.Client.CreaturesList.getEntryByObjectId(packet.ObjectId);
    if (creature && creature instanceof L2Character) {
      const [_x, _y, _z] = packet.Location;
      creature.Location = [_x, _y, _z];
      creature.IsSitting = packet.MoveType === SITTING;

      // Sitting down (and playing dead) pins a creature in place, and the
      // location above is the server telling us exactly where that happened.
      // Any walk still running locally has to end here: for the local player
      // that walk is our own client-side prediction (see CommandMoveTo), and
      // nothing else would ever stop it -- the server has no reason to send a
      // correction for a move it already considers over, so the body would go
      // on sliding to a destination it never reaches while sitting.
      if (packet.MoveType === SITTING || packet.MoveType === START_FAKE_DEATH) {
        creature.IsMoving = false;
      }
    }
  }
}
