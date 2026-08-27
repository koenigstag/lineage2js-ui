import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ValidateLocation from "../../incoming/game/ValidateLocation";

/**
 * The server's corrective "you are actually here" -- sent whenever it decides
 * a reported position is out of sync with its own (see lineage2ts's
 * ValidatePosition handler for the thresholds that trigger it: roughly 500
 * units of horizontal drift, 200 of Z, or 800 of falling).
 *
 * Writing the corrected coordinates straight onto the creature is enough
 * while it's standing still, but not while it's mid-walk. The move segment --
 * MoveFromX/Y/Z plus MoveStartedAt, which is what an interpolating consumer
 * actually draws from (see the UI's creature-movement.ts) -- would still
 * describe the old, uncorrected line, so nothing visible would change; and
 * setMovingTo's own 100ms stepper would overwrite the corrected X/Y/Z on its
 * very next tick anyway. The correction lands in the object and is then
 * ignored by everything that reads it.
 *
 * So a moving creature gets its segment re-issued from the corrected point to
 * the same destination it was already headed for -- "you are here, carry on
 * to where you were going" -- which resets the interpolation origin and the
 * stepper together. setMovingTo deliberately fires no StopMoving on a
 * redirect, and IsMoving only fires on an actual transition, so nothing
 * downstream sees a spurious stop/start for a walk that never stopped.
 *
 * Heading goes through setMovingTo, which treats 0 as "not supplied" and
 * recomputes it from the direction of travel instead -- the same answer for a
 * creature that really is walking, since the server's heading during a walk
 * is that direction.
 */
export default class ValidateLocationMutator extends IMMOClientMutator<GameClient, ValidateLocation> {
  update(packet: ValidateLocation): void {
    const creature = this.Client.CreaturesList.getEntryByObjectId(packet.ObjectId);
    if (!creature) {
      return;
    }

    const [x, y, z] = packet.Location;

    // The CurrentSpeed guard is for setMovingTo's tick math, which sizes the
    // walk by dividing by speed -- a zero would leave its interval spinning
    // forever. Shouldn't happen mid-walk, but a correction is precisely the
    // moment we trust our own view of this creature least.
    if (creature.IsMoving && creature.CurrentSpeed > 0) {
      creature.setMovingTo(x, y, z, creature.Dx, creature.Dy, creature.Dz, packet.Heading);
      return;
    }

    creature.Location = [x, y, z, packet.Heading];
  }
}
