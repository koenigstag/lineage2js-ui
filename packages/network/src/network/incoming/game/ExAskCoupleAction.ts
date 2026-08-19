import GameClientPacket from "./GameClientPacket";

export default class ExAskCoupleAction extends GameClientPacket {
  ActionId: number = 0;
  RequesterId: number = 0;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    const _sub = this.readH();

    this.ActionId = this.readD();
    this.RequesterId = this.readD();

    return true;
  }
}
