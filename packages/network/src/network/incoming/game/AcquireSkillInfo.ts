import GameClientPacket from "./GameClientPacket";
import { AcquireSkillType } from "../../../enums/AcquireSkillType";

export interface AcquireSkillRequirement {
  Type: number;
  ItemId: number;
  Count: number;
  Unknown: number;
}

// Sent in response to RequestAcquireSkillInfo -- the authoritative SP cost
// and item requirements for one specific skill/level, unlike
// AcquireSkillList's bare per-entry SpCost/Requirements-count.
export default class AcquireSkillInfo extends GameClientPacket {
  Id!: number;
  Level!: number;
  SpCost!: number;
  Type!: AcquireSkillType;
  Requirements: AcquireSkillRequirement[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.Id = this.readD();
    this.Level = this.readD();
    this.SpCost = this.readD();
    this.Type = this.readD();

    const _reqSize = this.readD();
    for (let i = 0; i < _reqSize; i++) {
      this.Requirements.push({
        Type: this.readD(),
        ItemId: this.readD(),
        Count: this.readQ(),
        Unknown: this.readD(),
      });
    }

    return true;
  }
}
