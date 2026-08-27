import GameServerPacket from "./GameServerPacket";

/**
 * Asks the server for a NetPing reply (see incoming/game/NetPing.ts).
 *
 * Opcode 0xb1, confirmed against lineage2ts's ReadPacketTranslator.ts
 * (`0xb1: RequestNetPing`). No body: that handler
 * (receive/RequestNetPing.ts) takes only the client and never reads packet
 * data -- it just answers with send/NetPing.ts.
 *
 * Note the direction. In High Five the *client* opens this exchange: we ask,
 * the server answers. C4-era packet documentation describes the opposite
 * (server pings, client must answer or be dropped) -- that is a different
 * protocol version, and following it here would mean waiting forever for a
 * ping the server only ever sends in reply.
 */
export default class RequestNetPing extends GameServerPacket {
  write(): void {
    this.writeC(0xb1);
  }
}
