import GameServerPacket from "./GameServerPacket";
import { ShortcutType } from "../../../enums/ShortcutType";

// Opcode 0x3D. Verified against L2J_Mobius's RequestShortcutReg.java --
// registers/updates one hotbar slot server-side. The server always echoes
// back a ShortCutRegister packet to confirm (see RequestShortcutReg.java's
// runImpl(): `player.sendPacket(new ShortcutRegister(sc))`), which is what
// GameStore's syncHotbar actually reacts to -- this packet alone doesn't
// update anything client-side.
export default class RequestShortCutReg extends GameServerPacket {
  constructor(
    private _type: ShortcutType,
    /** Combined slot: page*12 + column -- same value as L2Shortcut.Slot. */
    private _slot: number,
    private _targetId: number,
    /** SKILL shortcuts only. */
    private _level = 0,
    /** 1 - player, 2 - pet. */
    private _characterType = 1
  ) {
    super();
  }

  write(): void {
    this.writeC(0x3d);
    this.writeD(this._type);
    this.writeD(this._slot);
    this.writeD(this._targetId);
    this.writeD(this._level);
    this.writeD(this._characterType);
  }
}
