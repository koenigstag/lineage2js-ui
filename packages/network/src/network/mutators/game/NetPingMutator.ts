import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import NetPing from "../../incoming/game/NetPing";

export default class NetPingMutator extends IMMOClientMutator<GameClient, NetPing> {
  update(packet: NetPing): void {
    this.Client.OnlineTime = packet.OnlineTime;
  }
}
