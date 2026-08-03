import GameServerPacket from "./GameServerPacket";

export default class TradeRequest extends GameServerPacket {
  constructor(private _targetObjectId: number) {
    super();
  }

  write(): void {
    this.writeC(0x1a);
    this.writeD(this._targetObjectId);
  }
}
