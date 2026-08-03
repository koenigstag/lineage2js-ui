import GameServerPacket from "./GameServerPacket";

export default class RequestDuelAnswerStart extends GameServerPacket {
  static readonly ANSWER_ACCEPT = 1;
  static readonly ANSWER_DECLINE = 0;
  static readonly ANSWER_REFUSE = -1;

  constructor(private _partyDuel: boolean, private _answer: number) {
    super();
  }

  write(): void {
    this.writeC(0xd0);
    this.writeH(0x1c);
    this.writeD(this._partyDuel ? 1 : 0);
    // Unused by the server (RequestDuelAnswerStart.java reads and discards
    // it) -- kept as a literal 0 to match the real client's wire format.
    this.writeD(0);
    this.writeD(this._answer);
  }
}
