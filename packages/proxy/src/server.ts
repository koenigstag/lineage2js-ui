import http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { dialTarget, startBridge, type BridgeTarget } from "./bridge.js";
import { isTargetAllowed, type ProxyConfig, type StaticRoute } from "./config.js";
import type { Logger } from "./logger.js";

export interface ProxyServer {
  /** Ports actually listened on, in the order the listeners were created. */
  readonly ports: number[];
  readonly connections: number;
  close(): Promise<void>;
}

interface Listener {
  port: number;
  http: http.Server;
  wss: WebSocketServer;
}

/** Rejects an upgrade attempt with a plain HTTP response, before any WebSocket exists. */
function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  const statusText = http.STATUS_CODES[status] ?? "Error";
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain\r\n" +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      "\r\n" +
      message
  );
  socket.destroy();
}

/**
 * Resolves the TCP target of a dynamic-route request:
 * `/1.2.3.4/7777`, `/1.2.3.4:7777` or `/?host=1.2.3.4&port=7777`.
 */
export function parseDynamicTarget(url: string): BridgeTarget | undefined {
  const parsed = new URL(url, "http://proxy.invalid");

  const queryHost = parsed.searchParams.get("host");
  const queryPort = parsed.searchParams.get("port");
  if (queryHost && queryPort) {
    const port = Number(queryPort);
    return Number.isInteger(port) && port > 0 && port < 65536 ? { host: queryHost, port } : undefined;
  }

  const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [host, portSegment] =
    segments.length >= 2
      ? [segments[0], segments[1]]
      : segments.length === 1 && segments[0].includes(":")
        ? [segments[0].slice(0, segments[0].lastIndexOf(":")), segments[0].slice(segments[0].lastIndexOf(":") + 1)]
        : [undefined, undefined];

  if (!host || !portSegment) return undefined;

  const port = Number(portSegment);
  return Number.isInteger(port) && port > 0 && port < 65536 ? { host, port } : undefined;
}

function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (allowed.includes("*")) return true;
  // A non-browser client (or a same-origin-less context) sends no Origin at
  // all; with an explicit allowlist configured, only listed origins pass.
  if (!origin) return false;
  return allowed.some((entry) => entry.toLowerCase() === origin.toLowerCase());
}

export function startProxy(config: ProxyConfig, logger: Logger): Promise<ProxyServer> {
  const listeners: Listener[] = [];
  let connections = 0;
  let sessionSeq = 0;

  const describeRoutes = (): string[] => [
    ...config.routes.map((route) => `ws://${config.host}:${route.listenPort} -> ${route.targetHost}:${route.targetPort}`),
    ...(config.dynamicPort ? [`ws://${config.host}:${config.dynamicPort}/<host>/<port> -> dynamic`] : []),
  ];

  const createListener = (port: number, route: StaticRoute | undefined): Listener => {
    const server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", port, connections, routes: describeRoutes() }));
        return;
      }
      res.writeHead(426, { "Content-Type": "text/plain", Upgrade: "websocket" });
      res.end("This port only serves WebSocket connections (and GET /health).");
    });

    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      const peer = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
      const sessionLogger = logger.child(`#${++sessionSeq} ${peer}`);

      if (!isOriginAllowed(req.headers.origin, config.allowedOrigins)) {
        sessionLogger.warn(`rejected: origin "${req.headers.origin ?? "<none>"}" is not allowed`);
        rejectUpgrade(socket, 403, "Origin not allowed");
        return;
      }

      if (config.maxConnections > 0 && connections >= config.maxConnections) {
        sessionLogger.warn(`rejected: connection limit (${config.maxConnections}) reached`);
        rejectUpgrade(socket, 503, "Too many connections");
        return;
      }

      let target: BridgeTarget | undefined;
      if (route) {
        target = { host: route.targetHost, port: route.targetPort };
      } else {
        target = parseDynamicTarget(req.url ?? "/");
        if (!target) {
          sessionLogger.warn(`rejected: cannot read a target from "${req.url}"`);
          rejectUpgrade(socket, 400, "Expected ws://host:port/<targetHost>/<targetPort>");
          return;
        }
        if (!isTargetAllowed(target.host, target.port, config.allowedTargets)) {
          sessionLogger.warn(`rejected: target ${target.host}:${target.port} is not in the allowlist`);
          rejectUpgrade(socket, 403, "Target not allowed");
          return;
        }
      }

      const resolvedTarget = target;

      // Reserved up front so a burst of upgrades cannot slip past the limit
      // while their TCP connects are still in flight.
      connections++;
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        connections--;
      };

      sessionLogger.debug(`upgrading, dialing ${resolvedTarget.host}:${resolvedTarget.port}`);

      dialTarget(resolvedTarget, config.connectTimeoutMs).then(
        (tcp) => {
          if (socket.destroyed) {
            // Client gave up while we were dialing.
            tcp.destroy();
            release();
            return;
          }

          wss.handleUpgrade(req, socket, head, (ws) => {
            sessionLogger.info(`connected to ${resolvedTarget.host}:${resolvedTarget.port}`);
            ws.once("close", release);
            tcp.once("close", release);
            startBridge(ws, tcp, {
              framing: config.framing,
              idleTimeoutMs: config.idleTimeoutMs,
              logger: sessionLogger,
            });
          });
        },
        (err: Error) => {
          release();
          sessionLogger.warn(`cannot reach ${resolvedTarget.host}:${resolvedTarget.port}: ${err.message}`);
          rejectUpgrade(socket, 502, `Cannot reach ${resolvedTarget.host}:${resolvedTarget.port}`);
        }
      );
    });

    return { port, http: server, wss };
  };

  for (const route of config.routes) {
    listeners.push(createListener(route.listenPort, route));
  }
  if (config.dynamicPort !== undefined) {
    listeners.push(createListener(config.dynamicPort, undefined));
  }

  const closeAll = (): Promise<void> =>
    Promise.all(
      listeners.map(
        (listener) =>
          new Promise<void>((resolve) => {
            // Drops live sessions too -- without it, an open game connection
            // would keep the process alive indefinitely on shutdown.
            listener.wss.clients.forEach((client) => client.terminate());
            listener.wss.close(() => listener.http.close(() => resolve()));
          })
      )
    ).then(() => undefined);

  return Promise.all(
    listeners.map(
      (listener) =>
        new Promise<void>((resolve, reject) => {
          listener.http.once("error", reject);
          listener.http.listen(listener.port, config.host, () => {
            listener.http.removeListener("error", reject);
            resolve();
          });
        })
    )
  ).then(
    () => ({
      ports: listeners.map((listener) => listener.port),
      get connections() {
        return connections;
      },
      close: closeAll,
    }),
    (err) => closeAll().then(() => Promise.reject(err))
  );
}
