import AbstractGameCommand from "./AbstractGameCommand";
import RequestShortCutReg from "../network/outgoing/game/RequestShortCutReg";
import type L2Shortcut from "../entities/L2Shortcut";

export default class CommandRegisterShortcut extends AbstractGameCommand {
  execute(shortcut: L2Shortcut): void {
    this.GameClient.sendPacket(
      new RequestShortCutReg(shortcut.Type, shortcut.Slot, shortcut.TargetId, shortcut.Level ?? 0)
    );
  }
}
