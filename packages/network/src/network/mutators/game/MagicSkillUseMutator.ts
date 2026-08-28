import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import MagicSkillUse from "../../incoming/game/MagicSkillUse";

/**
 * "Creature X started casting skill Y", broadcast to everyone nearby. The
 * event carries the packet's own HitTime, so the cast animation runs for as
 * long as the server says the cast takes rather than for a length the client
 * invented -- unlike the pick-up stoop, which has no such number anywhere.
 */
export default class MagicSkillUseMutator extends IMMOClientMutator<
  GameClient,
  MagicSkillUse
> {
  update(packet: MagicSkillUse): void {
    const skill = this.Client.SkillsList.getEntryById(packet.SkillId);
    if (skill) {
      skill.Level = packet.SkillLevel;
      skill.Remaining = packet.ReuseDelay;
      skill.ReuseDelay = packet.ReuseDelay;
    }

    const creature = this.Client.CreaturesList.getEntryByObjectId(
      packet.ActiveCharObjId
    );
    if (creature) {
      creature.HiTime = packet.HitTime;
    }

    this.fire("MagicSkillUse", {
      creatureId: packet.ActiveCharObjId,
      skillId: packet.SkillId,
      hitTime: packet.HitTime,
    });
  }
}
