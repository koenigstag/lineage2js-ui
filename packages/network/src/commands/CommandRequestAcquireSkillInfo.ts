import AbstractGameCommand from "./AbstractGameCommand";
import RequestAcquireSkillInfo from "../network/outgoing/game/RequestAcquireSkillInfo";
import { AcquireSkillType } from "../enums/AcquireSkillType";

export default class CommandRequestAcquireSkillInfo extends AbstractGameCommand {
  execute(id: number, level: number, type: AcquireSkillType): void {
    this.GameClient?.sendPacket(new RequestAcquireSkillInfo(id, level, type));
  }
}
