import GameServerPacket from "./GameServerPacket";

export default class AnswerTradeRequest extends GameServerPacket {
  static readonly ANSWER_DECLINE = 0;
  static readonly ANSWER_ACCEPT = 1;

  constructor(private _answer: number) {
    super();
  }

  write(): void {
    this.writeC(0x55);
    this.writeD(this._answer);
  }
}
