import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ExAskCoupleAction from "../../incoming/game/ExAskCoupleAction";

export default class ExAskCoupleActionMutator extends IMMOClientMutator<
  GameClient,
  ExAskCoupleAction
> {
  update(packet: ExAskCoupleAction): void {
    this.Client.LastCoupleActionId = packet.ActionId;
    this.Client.LastCoupleActionRequesterId = packet.RequesterId;

    const requester = this.Client.CreaturesList.getEntryByObjectId(
      packet.RequesterId
    );

    this.fire("PairActionRequest", {
      requesterName: requester?.Name ?? "",
      actionId: packet.ActionId,
    });
  }
}
