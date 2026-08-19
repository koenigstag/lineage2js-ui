import L2Shortcut from "../../../entities/L2Shortcut";
import GameClientPacket from "./GameClientPacket";

export default class ShortCutRegister extends GameClientPacket {
  Shortcut!: L2Shortcut;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.Shortcut = this.readShortcut();

    return true;
  }
}
