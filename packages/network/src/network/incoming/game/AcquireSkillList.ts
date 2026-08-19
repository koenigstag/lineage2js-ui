import GameClientPacket from "./GameClientPacket";
import { AcquireSkillType } from "../../../enums/AcquireSkillType";

export interface AcquireSkillListEntry {
  Id: number;
  NextLevel: number;
  MaxLevel: number;
  SpCost: number;
  Requirements: number;
}

export default class AcquireSkillList extends GameClientPacket {
  Type!: AcquireSkillType;
  Skills: AcquireSkillListEntry[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.Type = this.readD();
    const _skillsSize = this.readD();
    for (let i = 0; i < _skillsSize; i++) {
      const entry: AcquireSkillListEntry = {
        Id: this.readD(),
        NextLevel: this.readD(),
        MaxLevel: this.readD(),
        SpCost: this.readD(),
        Requirements: this.readD(),
      };
      if (this.Type === AcquireSkillType.SUBPLEDGE) {
        const _unk = this.readD();
      }
      this.Skills.push(entry);
    }

    return true;
  }
}
