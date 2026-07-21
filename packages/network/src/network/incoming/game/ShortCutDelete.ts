import GameClientPacket from "./GameClientPacket";

// Opcode 0x46. Wasn't implemented at all previously -- verified against
// lineage2ts's ShortCutDelete send packet: writeC(0x46).writeD(slot).writeD(0).
export default class ShortCutDelete extends GameClientPacket {
  Slot!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.Slot = this.readD();
    const _unused = this.readD();

    return true;
  }
}
