import GameServerPacket from "./GameServerPacket";

export default class RequestOustPartyMember extends GameServerPacket {
  constructor(private _name: string) {
    super();
  }

  write(): void {
    this.writeC(0x45);
    this.writeS(this._name);
  }
}
