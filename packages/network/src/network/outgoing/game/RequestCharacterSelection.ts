import GameServerPacket from "./GameServerPacket";

// "Send me the character-selection roster." Needed after creating a character:
// CharacterCreate only refreshes the roster server-side and answers with a
// bare CharCreateOk, so this is what actually gets the new character's
// CharSelectionInfo pushed down.
//
// Extended packet 0xd0, sub-opcode 0x36 -- same wire shape as
// RequestManorList/RequestKeyMapping (writeH packs opcode + sub-opcode low
// byte, the trailing writeC is the sub-opcode's high byte).
export default class RequestCharacterSelection extends GameServerPacket {
  write(): void {
    this.writeH(0x36d0);
    this.writeC(0);
  }
}
