import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import NpcSay from "../../incoming/game/NpcSay";
import GameClient from "../../GameClient";

export default class NpcSayMutator extends IMMOClientMutator<
  GameClient,
  NpcSay
> {
  update(packet: NpcSay): void {
    this.fire("NpcSay", {
      objectId: packet.ObjectId,
      type: packet.Type,
      npcId: packet.NpcId,
      npcStringId: packet.NpcStringId,
      messages: packet.Messages,
    });
  }
}
