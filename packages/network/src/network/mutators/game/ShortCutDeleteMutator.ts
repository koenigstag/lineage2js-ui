import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ShortCutDelete from "../../incoming/game/ShortCutDelete";

export default class ShortCutDeleteMutator extends IMMOClientMutator<
  GameClient,
  ShortCutDelete
> {
  update(packet: ShortCutDelete): void {
    this.Client.Shortcuts.removeById(packet.Slot);
  }
}
