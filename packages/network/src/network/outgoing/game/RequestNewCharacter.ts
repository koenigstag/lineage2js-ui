import GameServerPacket from "./GameServerPacket";

export default class RequestNewCharacter extends GameServerPacket {
  constructor() {
    super();
  }

  write(): void {
    this.writeC(0x13);
  }
}
