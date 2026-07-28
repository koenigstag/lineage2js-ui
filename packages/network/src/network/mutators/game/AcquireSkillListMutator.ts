import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import AcquireSkillList from "../../incoming/game/AcquireSkillList";

export default class AcquireSkillListMutator extends IMMOClientMutator<
  GameClient,
  AcquireSkillList
> {
  update(packet: AcquireSkillList): void {
    this.Client.AcquireSkillList = packet;
  }
}
