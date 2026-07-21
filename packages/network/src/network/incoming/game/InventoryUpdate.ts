import L2Item from "../../../entities/L2Item";
import GameClientPacket from "./GameClientPacket";

export enum InventoryUpdateType {
  Add = 1,
  Modify = 2,
  Remove = 3,
}

export interface InventoryUpdateEntry {
  updateType: InventoryUpdateType;
  item: L2Item;
}

export default class InventoryUpdate extends GameClientPacket {
  Items: InventoryUpdateEntry[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    const _size = this.readH();
    for (let i = 0; i < _size; i++) {
      const updateType = this.readH(); // Update type : 01-add, 02-modify, 03-remove
      this.Items.push({ updateType, item: this.readItem() });
    }

    return true;
  }
}
