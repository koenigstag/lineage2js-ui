import GameServerPacket from "./GameServerPacket";

export default class AnswerCoupleAction extends GameServerPacket {
  static readonly ANSWER_ACCEPT = 1;
  static readonly ANSWER_DECLINE = 0;
  static readonly ANSWER_REFUSE = -1;

  constructor(
    private _actionId: number,
    private _answer: number,
    private _charObjId: number
  ) {
    super();
  }

  write(): void {
    this.writeC(0xd0);
    this.writeH(0x7a);
    this.writeD(this._actionId);
    this.writeD(this._answer);
    this.writeD(this._charObjId);
  }
}
