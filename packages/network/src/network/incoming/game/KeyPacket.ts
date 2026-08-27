import GameClientPacket from "./GameClientPacket";

/**
 * The game server's answer to our ProtocolVersion (opcode 0x2e) -- the
 * protocol version verdict, plus the key the rest of this connection is
 * XOR-encrypted with. Some emulator codebases call this same packet
 * "VersionCheck"; it is one packet, not two.
 *
 * This is the whole of the version check, and it happens before anything
 * else: lineage2ts's receive/RequestEncryptionKey.ts reads the version we
 * sent, tests it against its supported set (GameClientProtocolVersions), and
 * either enables encryption and answers Success, or answers
 * UnsupportedProtocol and closes the connection. It rejects the handshake
 * outright in two more cases that never reach this packet -- a second
 * RequestEncryptionKey once encryption is already on (a replay), and, when
 * the server runs behind a proxy, a client IP on its blocklist -- both of
 * which just drop the socket.
 *
 * Layout matched field for field against lineage2ts's send/KeyPacket.ts
 * (declared size 23): status byte, 8 key bytes, then D(1), D(1), C(1), D(0),
 * constants it writes unconditionally and this client has no use for.
 *
 * The status byte is KeyPacketStatus: 0 UnsupportedProtocol, 1 Success. A
 * rejection comes back through the same packet shape -- its prebuilt
 * UnsupportedProtocolKeyPacket is this packet with status 0 and an all-zero
 * key -- so the parse always succeeds and the verdict is reported rather
 * than thrown. Throwing here would be swallowed by GameClientPacket.read()
 * and surface later as a bare "connection closed by server", which is true
 * but useless; CommandSelectServer turns IsProtocolOk into a message that
 * says what actually happened.
 */
export default class KeyPacket extends GameClientPacket {
  /** False when the server refused our protocol version. BlowfishKey is all zeroes in that case and the socket is about to close. */
  IsProtocolOk!: boolean;
  BlowfishKey!: Uint8Array;

  // @Override
  readImpl(): boolean {
    const _id: number = this.readC();
    this.IsProtocolOk = this.readC() === 1; // KeyPacketStatus: 0 - wrong protocol, 1 - protocol ok
    const key = this.readB(8);
    const _unkn1 = this.readD();
    const _unkn2 = this.readD();
    const _unkn3 = this.readC();
    const _unkn4 = this.readD();

    this.BlowfishKey = new Uint8Array(16);
    this.BlowfishKey.set(key, 0);
    this.BlowfishKey.set(
      Uint8Array.from([0xc8, 0x27, 0x93, 0x01, 0xa1, 0x6c, 0x31, 0x97]),
      8
    ); // the last 8 bytes are static

    return true;
  }
}
