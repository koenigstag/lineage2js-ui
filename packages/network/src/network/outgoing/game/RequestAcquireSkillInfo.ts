import GameServerPacket from "./GameServerPacket";
import { AcquireSkillType } from "../../../enums/AcquireSkillType";

// Asks the trainer for the authoritative SpCost/Requirements for one
// skill/level -- server replies with AcquireSkillInfo. Server-side this
// requires the player to have an active getLastFolkNPC() (an
// interacted-with NPC trainer), a precondition this UI doesn't model.
export default class RequestAcquireSkillInfo extends GameServerPacket {
  private _id: number;
  private _level: number;
  private _type: AcquireSkillType;

  constructor(id: number, level: number, type: AcquireSkillType) {
    super();
    this._id = id;
    this._level = level;
    this._type = type;
  }

  write(): void {
    this.writeC(0x73);
    this.writeD(this._id);
    this.writeD(this._level);
    this.writeD(this._type);
  }
}
