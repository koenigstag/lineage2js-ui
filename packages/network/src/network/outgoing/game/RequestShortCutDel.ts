import GameServerPacket from "./GameServerPacket";

// Opcode 0x3F. Verified against L2J_Mobius's RequestShortcutDel.java --
// removes one hotbar slot server-side. Unlike RequestShortCutReg, the server
// sends no confirmation packet back (see its runImpl()'s own comment:
// "client needs no confirmation, this packet is just to inform the
// server"), so the caller must clear the slot client-side itself.
export default class RequestShortCutDel extends GameServerPacket {
  constructor(
    /** Combined slot: page*12 + column -- same value as L2Shortcut.Slot. */
    private _slot: number
  ) {
    super();
  }

  write(): void {
    this.writeC(0x3f);
    this.writeD(this._slot);
  }
}
