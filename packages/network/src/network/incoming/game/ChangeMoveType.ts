import GameClientPacket from "./GameClientPacket";

export default class ChangeMoveType extends GameClientPacket {
  static readonly WALK: number = 0;
  static readonly RUN: number = 1;

  ObjectId!: number;
  IsRunning!: boolean;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.ObjectId = this.readD();
    this.IsRunning = this.readD() === ChangeMoveType.RUN;
    const _pad1 = this.readD();

    return true;
  }
}
