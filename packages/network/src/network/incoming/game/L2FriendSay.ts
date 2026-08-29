import GameClientPacket from "./GameClientPacket";

/**
 * A private message sent through the friends list (opcode 0x78) rather than
 * through Say2's whisper channel -- the server answers RequestSendFriendMessage
 * (0x6b) with it. Carries both ends' names because the friends-list window is
 * its own conversation view in the real client; this one folds it into the
 * chat log under ChatType.FRIEND instead.
 *
 * Wire layout mirrors lineage2ts's packets/send/L2FriendSay.ts exactly.
 */
export default class L2FriendSay extends GameClientPacket {
  ReceiverName: string = "";
  SenderName: string = "";
  Message: string = "";

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    const _unknown = this.readD(); // always 0 on the wire
    this.ReceiverName = this.readS();
    this.SenderName = this.readS();
    this.Message = this.readS();

    return true;
  }
}
