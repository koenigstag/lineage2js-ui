import GameServerPacket from "./GameServerPacket";

/**
 * Answer to the server's GameGuardQuery (opcode 0xcb, confirmed against
 * lineage2ts's ReadPacketTranslator.ts).
 *
 * Its handler reads bytes [0..4) and [8..12) of this body, concatenates them
 * and compares sha1 of the result against a fixed digest; on a match the
 * connection is marked GameGuard-ok. See gameguard.ts for where the 16 bytes
 * come from and why they can't be derived.
 */
export default class GameGuardReply extends GameServerPacket {
  constructor(private _response: Uint8Array) {
    super();
  }

  write(): void {
    this.writeC(0xcb);
    this.writeB(this._response);
  }
}
