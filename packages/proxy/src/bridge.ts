import net from "node:net";
import type { WebSocket } from "ws";
import { PacketFramer } from "./framer.js";
import type { Logger } from "./logger.js";

/** WebSocket close codes used when the proxy is the one closing. */
const CLOSE_NORMAL = 1000;
const CLOSE_PROTOCOL_ERROR = 1002;
const CLOSE_UNSUPPORTED_DATA = 1003;
const CLOSE_INTERNAL_ERROR = 1011;

/**
 * How many bytes may sit in the WebSocket's send queue before the TCP side
 * gets paused. The game server can burst far faster than a slow browser
 * connection drains, and without this the queue is unbounded memory growth.
 */
const WS_BUFFER_HIGH_WATER_MARK = 1 << 20; // 1 MiB

export interface BridgeTarget {
  host: string;
  port: number;
}

export interface BridgeOptions {
  framing: "packet" | "raw";
  idleTimeoutMs: number;
  logger: Logger;
}

/**
 * Opens the TCP connection to the game/login server. Done *before* the
 * WebSocket upgrade is answered, so an unreachable server surfaces to the
 * browser as a failed handshake (which is what @lineage2js/network's
 * WebSocketAdapter.connect() rejects on) instead of a socket that opens and
 * then immediately dies.
 */
export function dialTarget(target: BridgeTarget, connectTimeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: target.host, port: target.port });

    // L2 packets are small and latency-sensitive (movement, attacks); Nagle
    // would coalesce them into ~40ms hiccups.
    socket.setNoDelay(true);

    const timer =
      connectTimeoutMs > 0
        ? setTimeout(() => {
            socket.destroy();
            reject(new Error(`TCP connect to ${target.host}:${target.port} timed out after ${connectTimeoutMs}ms`));
          }, connectTimeoutMs)
        : undefined;

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.removeListener("error", onError);
      resolve(socket);
    });

    function onError(err: Error): void {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    }

    socket.once("error", onError);
  });
}

/**
 * Pipes an accepted WebSocket and an already-connected TCP socket into each
 * other until either side goes away.
 */
export function startBridge(ws: WebSocket, socket: net.Socket, options: BridgeOptions): void {
  const { logger } = options;
  const framer = new PacketFramer();
  const startedAt = Date.now();

  let closed = false;
  let bytesToServer = 0;
  let bytesToClient = 0;
  let packetsToClient = 0;
  let tcpPausedByBackpressure = false;
  let wsPausedByBackpressure = false;

  // ws exposes no public handle on its underlying TCP socket, but pausing it
  // is the only way to apply backpressure towards the browser when the game
  // server cannot keep up with what the client sends.
  const wsSocket = (ws as unknown as { _socket?: net.Socket })._socket;

  const close = (code: number, reason: string, err?: unknown): void => {
    if (closed) return;
    closed = true;

    if (err) {
      logger.warn(`closing: ${reason}`, err instanceof Error ? err.message : err);
    } else {
      logger.debug(`closing: ${reason}`);
    }

    logger.info(
      `session ended after ${Date.now() - startedAt}ms ` +
        `(${bytesToServer}B to server, ${bytesToClient}B in ${packetsToClient} packets to client)`
    );

    socket.destroy();
    // Reason must fit in 123 bytes per the WebSocket spec, otherwise ws throws.
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close(code, reason.slice(0, 120));
    } else {
      ws.terminate();
    }
  };

  if (options.idleTimeoutMs > 0) {
    // Counts reads *and* writes, so traffic in either direction keeps the
    // session alive.
    socket.setTimeout(options.idleTimeoutMs, () => close(CLOSE_NORMAL, "idle timeout"));
  }

  // --- browser -> server ---------------------------------------------------

  ws.on("message", (data: unknown, isBinary: boolean) => {
    if (closed) return;

    if (!isBinary) {
      close(CLOSE_UNSUPPORTED_DATA, "expected binary frames");
      return;
    }

    const chunk = toBuffer(data);
    if (chunk.byteLength === 0) return;

    bytesToServer += chunk.byteLength;

    if (!socket.write(chunk) && wsSocket && !wsPausedByBackpressure) {
      wsPausedByBackpressure = true;
      wsSocket.pause();
      socket.once("drain", () => {
        wsPausedByBackpressure = false;
        if (!closed) wsSocket.resume();
      });
    }
  });

  ws.on("close", (code: number) => close(CLOSE_NORMAL, `client closed (${code})`));
  ws.on("error", (err: Error) => close(CLOSE_INTERNAL_ERROR, "client socket error", err));

  // --- server -> browser ---------------------------------------------------

  const sendToClient = (payload: Buffer): void => {
    bytesToClient += payload.byteLength;
    packetsToClient++;

    ws.send(payload, { binary: true }, (err) => {
      if (err) {
        close(CLOSE_INTERNAL_ERROR, "failed to forward to client", err);
        return;
      }
      if (tcpPausedByBackpressure && ws.bufferedAmount <= WS_BUFFER_HIGH_WATER_MARK) {
        tcpPausedByBackpressure = false;
        socket.resume();
      }
    });

    if (!tcpPausedByBackpressure && ws.bufferedAmount > WS_BUFFER_HIGH_WATER_MARK) {
      tcpPausedByBackpressure = true;
      socket.pause();
    }
  };

  socket.on("data", (chunk: Buffer) => {
    if (closed) return;

    if (options.framing === "raw") {
      sendToClient(chunk);
      return;
    }

    let packets: Buffer[];
    try {
      packets = framer.push(chunk);
    } catch (err) {
      // The stream is desynced -- forwarding anything past this point would
      // just feed the client garbage, so drop the session instead.
      close(CLOSE_PROTOCOL_ERROR, "malformed packet framing", err);
      return;
    }

    for (const packet of packets) sendToClient(packet);
  });

  socket.on("end", () => close(CLOSE_NORMAL, "server closed the connection"));
  socket.on("close", () => close(CLOSE_NORMAL, "server socket closed"));
  socket.on("error", (err: Error) => close(CLOSE_INTERNAL_ERROR, "server socket error", err));
}

/** ws hands binary payloads over as Buffer, ArrayBuffer or a fragment list. */
function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data as Uint8Array);
}
