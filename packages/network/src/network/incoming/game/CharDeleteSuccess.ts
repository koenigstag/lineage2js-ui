import GameClientPacket from "./GameClientPacket";

/**
 * Deletion accepted (opcode 0x1d) -- carries nothing but the opcode, matching
 * lineage2ts's send/CharacterDeleteSuccess.ts (declared size 1). The roster
 * that follows it is what actually says what changed, including how long the
 * character has before it goes for good (see CharSelectionInfo).
 */
export default class CharDeleteSuccess extends GameClientPacket {
  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    return true;
  }
}
