/**
 * Splits a raw TCP byte stream into whole L2 packets.
 *
 * Both the login and the game protocol prefix every packet with its own
 * length as a little-endian uint16 that *includes* the two length bytes
 * (see @lineage2js/network's LoginClient.pack()/GameClient.pack() for the
 * writing side, and MMOClient.process() for the reading side).
 *
 * TCP has no message boundaries, so a single socket "data" chunk can carry
 * half a packet, or three of them. WebSocket does have boundaries, and the
 * client's own transport (WebSocketAdapter) hands whatever arrives straight
 * to MMOClient.process(). That reader does re-assemble split packets on its
 * own, but it rejects with "Incomplete packet" every time it has to -- so
 * re-framing here keeps one WebSocket message == one L2 packet, which is
 * what the client would see when talking to a native WebSocket server.
 */
export class PacketFramer {
  /** uint16 length prefix, so no valid packet can exceed this. */
  static readonly MAX_PACKET_SIZE = 0xffff;

  private pending: Buffer = Buffer.alloc(0);

  /**
   * Feeds one TCP chunk in, gets every packet that became complete out.
   * Throws on a length prefix that cannot be part of a valid stream -- the
   * framing is desynced at that point and nothing after it can be trusted.
   */
  push(chunk: Buffer): Buffer[] {
    this.pending = this.pending.byteLength > 0 ? Buffer.concat([this.pending, chunk]) : chunk;

    const packets: Buffer[] = [];
    let offset = 0;

    while (this.pending.byteLength - offset >= 2) {
      const packetLength = this.pending.readUInt16LE(offset);

      // A packet is at least the 2 length bytes + a 1-byte opcode; anything
      // shorter means we are no longer reading a length prefix at all.
      if (packetLength <= 2) {
        throw new Error(`Malformed packet length ${packetLength} at offset ${offset}`);
      }

      if (this.pending.byteLength - offset < packetLength) break;

      packets.push(this.pending.subarray(offset, offset + packetLength));
      offset += packetLength;
    }

    // subarray() above is a view into `pending`, so the leftover tail has to
    // be copied before `pending` is reassigned -- otherwise a later concat
    // could reuse the memory the already-emitted packets still point at.
    this.pending = offset > 0 ? Buffer.from(this.pending.subarray(offset)) : this.pending;

    return packets;
  }

  /** Bytes of a half-received packet still waiting for the rest of the stream. */
  get pendingBytes(): number {
    return this.pending.byteLength;
  }
}
