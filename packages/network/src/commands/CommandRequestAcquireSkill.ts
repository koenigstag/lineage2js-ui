import AbstractGameCommand from "./AbstractGameCommand";
import RequestAcquireSkill from "../network/outgoing/game/RequestAcquireSkill";
import { AcquireSkillType } from "../enums/AcquireSkillType";

export default class CommandRequestAcquireSkill extends AbstractGameCommand {
  execute(id: number, level: number, type: AcquireSkillType, subType?: number): void {
    this.GameClient?.sendPacket(new RequestAcquireSkill(id, level, type, subType));
  }
}
