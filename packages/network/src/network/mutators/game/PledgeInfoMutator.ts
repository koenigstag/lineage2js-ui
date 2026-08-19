import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import PledgeInfo from "../../incoming/game/PledgeInfo";

export default class PledgeInfoMutator extends IMMOClientMutator<
  GameClient,
  PledgeInfo
> {
  update(packet: PledgeInfo): void {
    this.Client.PledgeInfoByClanId.set(packet.ClanId, packet);
  }
}
