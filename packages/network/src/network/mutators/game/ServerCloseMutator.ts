import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import ServerClose from "../../incoming/game/ServerClose";

export default class ServerCloseMutator extends IMMOClientMutator<
  GameClient,
  ServerClose
> {
  update(_packet: ServerClose): void {
    this.fire("ServerClose", {});
  }
}
