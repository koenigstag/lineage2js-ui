import L2Shortcut from "../../../entities/L2Shortcut";
import GameClientPacket from "./GameClientPacket";

// Opcode 0x45. Was previously a fully commented-out no-op (looked like a
// draft for a different chronicle's wire format); rewritten against
// lineage2ts's ShortCutInit send packet.
export default class ShortCutInit extends GameClientPacket {
  Shortcuts: L2Shortcut[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    const _size = this.readD();

    for (let i = 0; i < _size; i++) {
      this.Shortcuts.push(this.readShortcut());
    }

    return true;
  }
}
