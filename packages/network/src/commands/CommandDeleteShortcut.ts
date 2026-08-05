import AbstractGameCommand from "./AbstractGameCommand";
import RequestShortCutDel from "../network/outgoing/game/RequestShortCutDel";

export default class CommandDeleteShortcut extends AbstractGameCommand {
  /**
   * @param slot combined slot: page*12 + column -- same value as L2Shortcut.Slot.
   *
   * The server sends no confirmation packet back for a delete (see
   * RequestShortcutDel.java upstream: "client needs no confirmation, this
   * packet is just to inform the server"), so nothing would otherwise ever
   * remove this slot from GameClient.Shortcuts -- the next unrelated
   * ShortCutRegister/Init (e.g. placing a different shortcut) would rebuild
   * the hotbar from that stale collection and the "deleted" shortcut would
   * reappear. Mirrors what ShortCutDeleteMutator does for a server-pushed
   * delete, applied locally since this one never gets pushed back.
   */
  execute(slot: number): void {
    this.GameClient.sendPacket(new RequestShortCutDel(slot));
    this.GameClient.Shortcuts.removeById(slot);
  }
}
