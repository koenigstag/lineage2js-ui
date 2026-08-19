import GameServerPacket from "./GameServerPacket";
import { AcquireSkillType } from "../../../enums/AcquireSkillType";

// Commits to learning one skill/level -- server deducts Sp, consumes any
// required item, then replies with AcquireSkillDone plus fresh SkillList/
// AcquireSkillList/UserInfo packets. Same getLastFolkNPC() trainer-proximity
// requirement as RequestAcquireSkillInfo applies server-side.
export default class RequestAcquireSkill extends GameServerPacket {
  private _id: number;
  private _level: number;
  private _type: AcquireSkillType;
  private _subType?: number;

  constructor(id: number, level: number, type: AcquireSkillType, subType?: number) {
    super();
    this._id = id;
    this._level = level;
    this._type = type;
    this._subType = subType;
  }

  write(): void {
    this.writeC(0x7c);
    this.writeD(this._id);
    this.writeD(this._level);
    this.writeD(this._type);
    if (this._type === AcquireSkillType.SUBPLEDGE) {
      this.writeD(this._subType ?? 0);
    }
  }
}
