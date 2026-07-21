import ProtocolVersion from "./outgoing/game/ProtocolVersion";
import GameCrypt from "./GameCrypt";
import WebSocketAdapter from "../socket/adapters/WebSocket.adapter";

const PING_PROTOCOL_VERSION = -2;
const DEFAULT_TIMEOUT_MS = 5000;

// ProtocolVersion is always sent unencrypted (the encryption key isn't
// established yet at this point in the real protocol either) -- a fresh
// GameCrypt's encrypt() is a no-op until a key is set, so this matches
// GameClient.pack() without needing a real GameClient instance.
function packUnencrypted(packet: ProtocolVersion): Uint8Array {
  packet.write();
  new GameCrypt().encrypt(packet.Buffer, 0, packet.Position);

  const sendable = new Uint8Array(packet.Position + 2);
  sendable[0] = (packet.Position + 2) & 0xff;
  sendable[1] = (packet.Position + 2) >>> 8;
  sendable.set(packet.Buffer.slice(0, packet.Position), 2);
  return sendable;
}

/**
 * Measures round-trip latency to a game server using the protocol's own
 * "ping" trick: a ProtocolVersion of -2 is treated by real servers as a
 * ping probe rather than a real handshake attempt (see L2J_Mobius'
 * ProtocolVersion.java: "This is just a ping attempt from the new C2
 * client"), and the connection gets closed immediately afterwards -- some
 * servers first send a rejection packet, others just close. Either the
 * first received byte or the connection closing (WebSocketAdapter.recv()
 * rejects once it sees the close) signals "done", so both cases resolve.
 */
export async function pingGameServer(ip: string, port: number, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<number> {
  const stream = new WebSocketAdapter(`ws://${ip}:${port}`);
  const start = performance.now();

  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Ping to ${ip}:${port} timed out`)), timeoutMs);
  });

  try {
    await Promise.race([stream.connect(), timeout]);
    await stream.send(packUnencrypted(new ProtocolVersion(PING_PROTOCOL_VERSION)));
    await Promise.race([stream.recv().catch(() => undefined), timeout]);

    return performance.now() - start;
  } finally {
    clearTimeout(timer);
    stream.close();
  }
}
