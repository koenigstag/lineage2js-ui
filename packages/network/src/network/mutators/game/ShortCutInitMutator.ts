import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ShortCutInit from "../../incoming/game/ShortCutInit";

export default class ShortCutInitMutator extends IMMOClientMutator<
  GameClient,
  ShortCutInit
> {
  update(packet: ShortCutInit): void {
    this.Client.Shortcuts.clear();
    packet.Shortcuts.forEach((shortcut) => this.Client.Shortcuts.add(shortcut));
  }
}
