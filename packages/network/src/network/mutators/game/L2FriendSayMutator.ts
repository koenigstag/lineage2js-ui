import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import L2FriendSay from "../../incoming/game/L2FriendSay";
import GameClient from "../../GameClient";

export default class L2FriendSayMutator extends IMMOClientMutator<
  GameClient,
  L2FriendSay
> {
  update(packet: L2FriendSay): void {
    this.fire("L2FriendSay", {
      receiverName: packet.ReceiverName,
      senderName: packet.SenderName,
      message: packet.Message,
    });
  }
}
