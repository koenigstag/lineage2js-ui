import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import AcquireSkillInfo from "../../incoming/game/AcquireSkillInfo";

export default class AcquireSkillInfoMutator extends IMMOClientMutator<
  GameClient,
  AcquireSkillInfo
> {
  update(packet: AcquireSkillInfo): void {
    this.Client.AcquireSkillInfoByKey.set(`${packet.Id}_${packet.Level}`, packet);
  }
}
