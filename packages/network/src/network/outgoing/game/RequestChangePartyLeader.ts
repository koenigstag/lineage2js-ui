import GameServerPacket from "./GameServerPacket";

export default class RequestChangePartyLeader extends GameServerPacket {
  constructor(private _name: string) {
    super();
  }

  write(): void {
    this.writeC(0xd0);
    this.writeH(0x0c);
    this.writeS(this._name);
  }
}
