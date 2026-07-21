import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import InventoryUpdate, { InventoryUpdateType } from "../../incoming/game/InventoryUpdate";

export default class InventoryUpdateMutator extends IMMOClientMutator<
  GameClient,
  InventoryUpdate
> {
  update(packet: InventoryUpdate): void {
    packet.Items.forEach(({ updateType, item }) => {
      const currentItem = this.Client.InventoryItems.getEntryByObjectId(item.ObjectId);
      if (currentItem) {
        this.Client.InventoryItems.delete(currentItem);
      }

      if (updateType !== InventoryUpdateType.Remove) {
        this.Client.InventoryItems.add(item);
      }
    });
  }
}
