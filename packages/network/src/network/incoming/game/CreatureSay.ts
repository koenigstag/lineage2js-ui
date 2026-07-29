import { ChatType } from "../../../enums/ChatType";
import GameClientPacket from "./GameClientPacket";

export default class CreatureSay extends GameClientPacket {
  ObjectId: number = 0;
  Type: number = 0;
  CharName: string = "";
  /** Only set (and CharName left empty) when Type === ChatType.BOAT -- see readImpl. */
  CharacterTemplateId: number = 0;
  NpcStringId: number = 0;
  Messages: string[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.ObjectId = this.readD();
    this.Type = this.readD();

    // Every chat type writes the sender's name (writeString) except BOAT,
    // which writes a numeric character/template id (writeInt) instead --
    // matches CreatureSay.java's writeImpl and lineage2ts's SayText.ts.
    if (this.Type === ChatType.BOAT) {
      this.CharacterTemplateId = this.readD();
    } else {
      this.CharName = this.readS();
    }

    this.NpcStringId = this.readD();
    while (this._offset + 2 < this._buffer.byteLength) {
      this.Messages.push(this.readS());
    }

    return true;
  }
}
