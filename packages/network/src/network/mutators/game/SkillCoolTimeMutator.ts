import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import SkillCoolTime from "../../incoming/game/SkillCoolTime";

export default class SkillCoolTimeMutator extends IMMOClientMutator<
  GameClient,
  SkillCoolTime
> {
  update(packet: SkillCoolTime): void {
    // Skill reuse timers (skill bar cooldown), not active buffs/debuffs --
    // those are a separate collection populated by AbnormalStatusUpdate.
    packet.BuffsList.forEach((row) => {
      const skill = this.Client.SkillsList.getEntryById(row.id);
      if (skill) {
        skill.Remaining = row.remaining * 1000;
        skill.ReuseDelay = row.reuse * 1000;
      }
    });
  }
}
