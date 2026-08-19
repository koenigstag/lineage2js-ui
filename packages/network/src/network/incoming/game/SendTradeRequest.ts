import GameClientPacket from "./GameClientPacket";

export default class SendTradeRequest extends GameClientPacket {
  SenderId: number = 0;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.SenderId = this.readD();

    return true;
  }
}
