import GameServerPacket from "./GameServerPacket";

// Opcode 0x60, confirmed against lineage2ts's ReadPacketTranslator.ts
// (`0x60: RequestDestroyItem`) and its receive/RequestDestroyItem.ts
// (`readD()` objectId then `readQ()` count) -- also cross-checked against
// L2J_Mobius's RequestDestroyItem.java (same field order/types). A genuinely
// separate action/opcode from both RequestDropItem (0x17, drops on the
// ground) and RequestSellItem (0x37, requires an active NPC shop session).
export default class RequestDestroyItem extends GameServerPacket {
  constructor(private _objectId: number, private _count: number) {
    super();
  }
  write(): void {
    this.writeC(0x60);
    this.writeD(this._objectId);
    this.writeQ(this._count);
  }
}
