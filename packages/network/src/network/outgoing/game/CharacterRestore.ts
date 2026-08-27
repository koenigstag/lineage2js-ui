import GameServerPacket from "./GameServerPacket";

/**
 * Cancels a pending deletion, by roster slot index -- the counterpart to
 * CharacterDelete while its timer is still running.
 *
 * Opcode 0x7b, confirmed against lineage2ts's ReadPacketTranslator.ts
 * (`0x7b: CharacterRestore`), whose handler reads a single D and answers with
 * a refreshed roster only -- there is no dedicated success or failure packet
 * for restore, unlike delete.
 */
export default class CharacterRestore extends GameServerPacket {
  constructor(private _slotIndex: number) {
    super();
  }

  write(): void {
    this.writeC(0x7b);
    this.writeD(this._slotIndex);
  }
}
