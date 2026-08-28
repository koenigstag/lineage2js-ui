import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import MagicSkillLaunched from "../../incoming/game/MagicSkillLaunched";

/**
 * The other end of MagicSkillUse: the cast finished and the skill went off.
 * Lets a listener close the casting window exactly when the server says it
 * ended, instead of waiting out the HitTime it opened with -- which matters
 * for a cast the server cut short.
 */
export default class MagicSkillLaunchedMutator extends IMMOClientMutator<
  GameClient,
  MagicSkillLaunched
> {
  update(packet: MagicSkillLaunched): void {
    this.fire("MagicSkillLaunched", {
      creatureId: packet.ActiveCharObjId,
      skillId: packet.SkillId,
    });
  }
}
