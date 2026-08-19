import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ExBasicActionList from "../../incoming/game/ExBasicActionList";

export default class ExBasicActionListMutator extends IMMOClientMutator<
  GameClient,
  ExBasicActionList
> {
  update(packet: ExBasicActionList): void {
    this.Client.BasicActionIds = new Set(packet.ActionIds);
  }
}
