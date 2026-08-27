import GameServerPacket from "./GameServerPacket";

/**
 * Requests deletion of one of the account's characters, by its slot index in
 * the roster CharSelectionInfo last sent (not an ObjectId).
 *
 * Opcode 0x0d, confirmed against lineage2ts's ReadPacketTranslator.ts
 * (`0x0d: CharacterDelete` among the character-manager packets), whose
 * handler reads a single D and nothing else.
 *
 * Deletion is normally deferred, not immediate: the server marks the
 * character and starts a timer, which comes back as DeleteSecondsLeft on the
 * next roster (see CharSelectionInfo). CharacterRestore cancels it while it
 * is still running.
 */
export default class CharacterDelete extends GameServerPacket {
  constructor(private _slotIndex: number) {
    super();
  }

  write(): void {
    this.writeC(0x0d);
    this.writeD(this._slotIndex);
  }
}
