import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import Attack from "../../incoming/game/Attack";
import GameClient from "../../GameClient";
import { headingBetween } from "../../../entities/l2-heading";

export default class AttackMutator extends IMMOClientMutator<
  GameClient,
  Attack
> {
  update(packet: Attack): void {
    // The attacker visually turns to face its target on every hit (real L2
    // clients do this too) -- the protocol carries no explicit heading field
    // for it though (see Attack.ts's TargetX/Y/Z comment), so derive one
    // from the packet's own attacker/target positions, same formula
    // L2Creature.setMovingTo already uses for a mover's own heading. Without
    // this, an attacker's heading was frozen at whatever it last was set to
    // (typically stale from its last actual move), even while attacking
    // someone standing in a completely different direction.
    const attacker = this.Client.CreaturesList.getEntryByObjectId(packet.AttackerObjectId);
    if (attacker) {
      attacker.Heading = headingBetween(packet.AttackerX, packet.AttackerY, packet.TargetX, packet.TargetY);
    }

    this.fire(`Attacked`, {
      object: packet.AttackerObjectId,
      subjects: packet.Subjects,
    });
  }
}
