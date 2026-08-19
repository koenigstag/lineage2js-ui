import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import SendTradeRequest from "../../incoming/game/SendTradeRequest";

export default class SendTradeRequestMutator extends IMMOClientMutator<
  GameClient,
  SendTradeRequest
> {
  update(packet: SendTradeRequest): void {
    const requester = this.Client.CreaturesList.getEntryByObjectId(
      packet.SenderId
    );

    this.fire("TradeRequest", {
      requesterId: packet.SenderId,
      requesterName: requester?.Name ?? "",
    });
  }
}
