import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ShortCutRegister from "../../incoming/game/ShortCutRegister";

export default class ShortCutRegisterMutator extends IMMOClientMutator<
  GameClient,
  ShortCutRegister
> {
  update(packet: ShortCutRegister): void {
    this.Client.Shortcuts.removeById(packet.Shortcut.Slot);
    this.Client.Shortcuts.add(packet.Shortcut);
  }
}
