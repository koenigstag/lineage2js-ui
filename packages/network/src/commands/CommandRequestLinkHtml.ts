import AbstractGameCommand from "./AbstractGameCommand";
import RequestLinkHtml from "../network/outgoing/game/RequestLinkHtml";

export default class CommandRequestLinkHtml extends AbstractGameCommand {
    execute(link: string): void {
        this.GameClient?.sendPacket(new RequestLinkHtml(link));
    }
}
