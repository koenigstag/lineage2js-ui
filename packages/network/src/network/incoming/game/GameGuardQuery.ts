import GameClientPacket from "./GameClientPacket";

/**
 * The game server's GameGuard challenge (opcode 0x74) -- four int32s the
 * client is expected to answer with GameGuardReply (see
 * outgoing/game/GameGuardReply.ts).
 *
 * Matched against lineage2ts's send/GameGuardQuery.ts: writeC(0x74) then
 * writeD of 0x27533DD9, 0x2E72A51D, 0x2017038B and -1017438557, declared size
 * 17. Read as 16 raw bytes rather than four numbers because that's the form
 * the response table is keyed on -- and the same 16 bytes the login server's
 * handshake already asks about (see gameguard.ts).
 */
export default class GameGuardQuery extends GameClientPacket {
  /** The 16 challenge bytes, in wire order. */
  Challenge!: Uint8Array;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.Challenge = this.readB(16);

    return true;
  }
}
