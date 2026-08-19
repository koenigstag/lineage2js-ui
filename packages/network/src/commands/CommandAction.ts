import { Actions } from "../enums/Actions";
import { actionPackets } from "./actionPackets";
import AbstractGameCommand from "./AbstractGameCommand";

export default class CommandAction extends AbstractGameCommand {
  execute(action: keyof typeof Actions, ctrlPressed?: boolean, shiftPressed?: boolean): void {
    this.GameClient?.sendPacket(actionPackets[action](ctrlPressed, shiftPressed));
  }
}
