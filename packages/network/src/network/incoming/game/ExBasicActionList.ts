import GameClientPacket from "./GameClientPacket";

export default class ExBasicActionList extends GameClientPacket {
  ActionIds: number[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    const _sub = this.readH();

    const count = this.readD();
    for (let i = 0; i < count; i++) {
      this.ActionIds.push(this.readD());
    }

    return true;
  }
}
