import GameServerPacket from "./GameServerPacket";

// Opcode 0x16, confirmed against lineage2ts's ReadPacketTranslator.ts
// (`0x16: RequestUnEquipItem`) and its receive/RequestUnEquipItem.ts
// (`readD()` a single slot value -- NOT an item objectId). That slot is an
// L2ItemSlots bitmask, numerically identical to this package's own
// L2Item.SLOT_* constants (confirmed against lineage2ts's own
// enums/L2ItemSlots.ts). Equipping has no separate packet -- RequestEquipItem
// (0x15) is a no-op on lineage2ts; the real client always equips via UseItem
// (0x19, see UseItem.ts), whose handler toggles equip state based on the
// item's current isEquipped() -- see CommandUseItem.ts.
export default class RequestUnEquipItem extends GameServerPacket {
  constructor(private _slot: number) {
    super();
  }
  write(): void {
    this.writeC(0x16);
    this.writeD(this._slot);
  }
}
