import GameServerPacket from "./GameServerPacket";

export default class RequestLinkHtml extends GameServerPacket {
  constructor(public link: string) {
    super();
  }

  write(): void {
    this.writeC(0x22);
    this.writeS(this.link);
  }
}
