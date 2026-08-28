import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ChangeMoveType from "../../incoming/game/ChangeMoveType";
import L2Creature from "../../../entities/L2Creature";

/**
 * Walk/run toggles. CharInfo/NpcInfo/UserInfo only carry the flag when a
 * creature first comes into view, so without this a creature that switches
 * mid-session keeps whatever it was doing when we met it -- and the flag is
 * not decorative: L2Creature.CurrentSpeed picks RunSpeed or WalkSpeed off it,
 * which drives both the client-side movement prediction and the walk-vs-run
 * animation the UI plays.
 */
export default class ChangeMoveTypeMutator extends IMMOClientMutator<GameClient, ChangeMoveType> {
  update(packet: ChangeMoveType): void {
    const creature = this.Client.CreaturesList.getEntryByObjectId(packet.ObjectId);
    if (creature instanceof L2Creature) {
      creature.IsRunning = packet.IsRunning;
    }
  }
}
