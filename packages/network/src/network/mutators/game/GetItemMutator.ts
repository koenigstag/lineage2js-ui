import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import GetItem from "../../incoming/game/GetItem";

/**
 * "Creature X picked up item Y", broadcast to everyone nearby -- so this is
 * what the pick-up animation plays off, for other players as much as for us.
 * The item's own removal rides on DeleteObject as usual; nothing here touches
 * the world's item list.
 */
export default class GetItemMutator extends IMMOClientMutator<GameClient, GetItem> {
  update(packet: GetItem): void {
    this.fire("GetItem", { creatureId: packet.PlayerId, itemId: packet.ObjectId });
  }
}
