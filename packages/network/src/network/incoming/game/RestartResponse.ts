import GameClientPacket from "./GameClientPacket";

export default class RestartResponse extends GameClientPacket {
  /** 1 when the server accepted the restart, 0 when it refused (in combat, trading, ...). */
  Result!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.Result = this.readD();

    return true;
  }
}
