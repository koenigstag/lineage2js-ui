import { isLogLevel, type LogLevel } from "./logger.js";

/** One WebSocket listener bound to a fixed TCP target. */
export interface StaticRoute {
  listenPort: number;
  targetHost: string;
  targetPort: number;
}

/** `host:port` pattern a dynamic-route request is checked against; "*" matches anything. */
export interface TargetPattern {
  host: string;
  port: string;
}

export interface ProxyConfig {
  /** Address the listeners bind to. */
  host: string;
  routes: StaticRoute[];
  /**
   * Port for the single "target comes from the URL" listener
   * (`ws://proxy:PORT/host/port`), or undefined to not open one.
   */
  dynamicPort?: number;
  /** Targets a dynamic-route request may ask for. Empty means "nothing is allowed". */
  allowedTargets: TargetPattern[];
  /** `Origin` headers accepted on the upgrade, or ["*"] for any (including none). */
  allowedOrigins: string[];
  /** "packet" re-frames the TCP stream into one WebSocket message per L2 packet. */
  framing: "packet" | "raw";
  connectTimeoutMs: number;
  /** Closes a session after this long without traffic in either direction; 0 disables. */
  idleTimeoutMs: number;
  /** Rejects further upgrades once this many sessions are live; 0 disables. */
  maxConnections: number;
  logLevel: LogLevel;
}

export const DEFAULTS = {
  host: "0.0.0.0",
  targetHost: "127.0.0.1",
  framing: "packet",
  connectTimeoutMs: 10_000,
  idleTimeoutMs: 0,
  maxConnections: 256,
  logLevel: "info",
} as const;

export class ConfigError extends Error {}

function parsePort(value: string, what: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`${what} must be a port number in 1..65535, got "${value}"`);
  }
  return port;
}

function parseNonNegativeInt(value: string, what: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ConfigError(`${what} must be a non-negative integer, got "${value}"`);
  }
  return parsed;
}

/**
 * Parses one route: `2106=1.2.3.4:2106`, `2106=2106` (default target host),
 * or bare `2106` (same port on the default target host).
 */
export function parseRoute(entry: string, defaultTargetHost: string): StaticRoute {
  const [left, right] = entry.split("=", 2).map((part) => part.trim());
  const listenPort = parsePort(left, `route "${entry}" listen port`);

  if (!right) {
    return { listenPort, targetHost: defaultTargetHost, targetPort: listenPort };
  }

  const separator = right.lastIndexOf(":");
  if (separator === -1) {
    return { listenPort, targetHost: defaultTargetHost, targetPort: parsePort(right, `route "${entry}" target port`) };
  }

  const targetHost = right.slice(0, separator).trim();
  if (!targetHost) {
    throw new ConfigError(`route "${entry}" has an empty target host`);
  }

  return { listenPort, targetHost, targetPort: parsePort(right.slice(separator + 1), `route "${entry}" target port`) };
}

/** Parses one allowlist entry: `1.2.3.4:7777`, `1.2.3.4:*`, or `*` (anything). */
export function parseTargetPattern(entry: string): TargetPattern {
  const trimmed = entry.trim();
  if (trimmed === "*") {
    return { host: "*", port: "*" };
  }

  const separator = trimmed.lastIndexOf(":");
  if (separator === -1) {
    return { host: trimmed.toLowerCase(), port: "*" };
  }

  const host = trimmed.slice(0, separator).trim().toLowerCase();
  const port = trimmed.slice(separator + 1).trim();
  if (!host) {
    throw new ConfigError(`allowed target "${entry}" has an empty host`);
  }
  if (port !== "*") {
    parsePort(port, `allowed target "${entry}" port`);
  }

  return { host, port };
}

export function isTargetAllowed(host: string, port: number, patterns: TargetPattern[]): boolean {
  const normalized = host.toLowerCase();
  return patterns.some(
    (pattern) =>
      (pattern.host === "*" || pattern.host === normalized) &&
      (pattern.port === "*" || Number(pattern.port) === port)
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** `--dynamic-port 8080` / `--dynamic-port=8080` / `--help` -> { "dynamic-port": "8080", help: "true" }. */
export function parseArgv(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new ConfigError(`Unexpected argument "${arg}" (expected --flag or --flag=value)`);
    }

    const [name, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[name] = inlineValue;
    } else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
      flags[name] = argv[++i];
    } else {
      flags[name] = "true";
    }
  }

  return flags;
}

/**
 * Builds the config from env vars, with CLI flags (same names, kebab-cased
 * without the `PROXY_` prefix) taking precedence.
 */
export function loadConfig(env: NodeJS.ProcessEnv, argv: string[] = []): ProxyConfig {
  const flags = parseArgv(argv);
  const read = (flag: string, envName: string): string | undefined => flags[flag] ?? env[envName];

  const defaultTargetHost = read("target-host", "PROXY_TARGET_HOST") || DEFAULTS.targetHost;

  // Repeated `--route` flags collapse into the last one (parseArgv is a flat
  // map), so the multi-route form is the comma-separated list either way.
  const routesValue = read("routes", "PROXY_ROUTES") ?? flags.route;
  const routes = routesValue ? splitList(routesValue).map((entry) => parseRoute(entry, defaultTargetHost)) : [];

  const dynamicPortValue = read("dynamic-port", "PROXY_DYNAMIC_PORT");
  const dynamicPort = dynamicPortValue ? parsePort(dynamicPortValue, "PROXY_DYNAMIC_PORT") : undefined;

  if (routes.length === 0 && dynamicPort === undefined) {
    throw new ConfigError(
      "Nothing to listen on: set PROXY_ROUTES (e.g. \"2106=server:2106,7777=server:7777\") " +
        "and/or PROXY_DYNAMIC_PORT. Run with --help for details."
    );
  }

  const duplicate = routes.find((route, index) => routes.findIndex((r) => r.listenPort === route.listenPort) !== index);
  if (duplicate) {
    throw new ConfigError(`Port ${duplicate.listenPort} is used by more than one route`);
  }
  if (dynamicPort !== undefined && routes.some((route) => route.listenPort === dynamicPort)) {
    throw new ConfigError(`Port ${dynamicPort} is used by both a static route and the dynamic listener`);
  }

  const allowedTargetsValue = read("allowed-targets", "PROXY_ALLOWED_TARGETS");
  const allowedTargets = allowedTargetsValue ? splitList(allowedTargetsValue).map(parseTargetPattern) : [];

  // Without an allowlist the dynamic listener would relay TCP to *any*
  // host:port on the internet for anyone who can reach it -- an open relay.
  // Static routes are safe by construction (their target is fixed here).
  if (dynamicPort !== undefined && allowedTargets.length === 0) {
    throw new ConfigError(
      "PROXY_DYNAMIC_PORT needs PROXY_ALLOWED_TARGETS (e.g. \"server:*\"), otherwise the proxy is an open relay. " +
        "Use \"*\" to knowingly allow every target."
    );
  }

  const framingValue = read("framing", "PROXY_FRAMING") || DEFAULTS.framing;
  if (framingValue !== "packet" && framingValue !== "raw") {
    throw new ConfigError(`PROXY_FRAMING must be "packet" or "raw", got "${framingValue}"`);
  }

  const logLevelValue = read("log-level", "PROXY_LOG_LEVEL") || DEFAULTS.logLevel;
  if (!isLogLevel(logLevelValue)) {
    throw new ConfigError(`PROXY_LOG_LEVEL must be one of silent|error|warn|info|debug, got "${logLevelValue}"`);
  }

  const connectTimeoutValue = read("connect-timeout-ms", "PROXY_CONNECT_TIMEOUT_MS");
  const idleTimeoutValue = read("idle-timeout-ms", "PROXY_IDLE_TIMEOUT_MS");
  const maxConnectionsValue = read("max-connections", "PROXY_MAX_CONNECTIONS");

  return {
    host: read("host", "PROXY_HOST") || DEFAULTS.host,
    routes,
    dynamicPort,
    allowedTargets,
    allowedOrigins: splitList(read("allowed-origins", "PROXY_ALLOWED_ORIGINS") ?? "*"),
    framing: framingValue,
    connectTimeoutMs: connectTimeoutValue
      ? parseNonNegativeInt(connectTimeoutValue, "PROXY_CONNECT_TIMEOUT_MS")
      : DEFAULTS.connectTimeoutMs,
    idleTimeoutMs: idleTimeoutValue
      ? parseNonNegativeInt(idleTimeoutValue, "PROXY_IDLE_TIMEOUT_MS")
      : DEFAULTS.idleTimeoutMs,
    maxConnections: maxConnectionsValue
      ? parseNonNegativeInt(maxConnectionsValue, "PROXY_MAX_CONNECTIONS")
      : DEFAULTS.maxConnections,
    logLevel: logLevelValue,
  };
}

export const USAGE = `l2js-proxy -- WebSocket <-> TCP bridge for Lineage 2 servers without WebSocket support

Usage:
  l2js-proxy --routes "2106=server:2106,7777=server:7777"
  l2js-proxy --dynamic-port 8080 --allowed-targets "server:*"

("server" being the L2 server's host as seen from the proxy -- 127.0.0.1 if
they run on the same machine, a hostname/IP/container name otherwise.)

Options (env var in parentheses; flags win):
  --routes <list>            (PROXY_ROUTES)            comma-separated "listenPort=targetHost:targetPort"
                                                       entries; "listenPort=targetPort" and bare "listenPort"
                                                       fall back to the default target host
  --target-host <host>       (PROXY_TARGET_HOST)       default target host for routes [${DEFAULTS.targetHost}]
  --dynamic-port <port>      (PROXY_DYNAMIC_PORT)      extra listener taking its target from the URL:
                                                       ws://proxy:<port>/<host>/<targetPort>
  --allowed-targets <list>   (PROXY_ALLOWED_TARGETS)   comma-separated "host:port" patterns the dynamic
                                                       listener may connect to ("host:*", "*"); required
                                                       whenever --dynamic-port is set
  --allowed-origins <list>   (PROXY_ALLOWED_ORIGINS)   accepted browser Origin headers, or "*" [*]
  --host <address>           (PROXY_HOST)              bind address [${DEFAULTS.host}]
  --framing <packet|raw>     (PROXY_FRAMING)           "packet" sends one WebSocket message per L2 packet,
                                                       "raw" forwards TCP chunks as they arrive [${DEFAULTS.framing}]
  --connect-timeout-ms <ms>  (PROXY_CONNECT_TIMEOUT_MS)  TCP connect timeout [${DEFAULTS.connectTimeoutMs}]
  --idle-timeout-ms <ms>     (PROXY_IDLE_TIMEOUT_MS)   close after this long without traffic, 0 = never [${DEFAULTS.idleTimeoutMs}]
  --max-connections <n>      (PROXY_MAX_CONNECTIONS)   max concurrent sessions, 0 = unlimited [${DEFAULTS.maxConnections}]
  --log-level <level>        (PROXY_LOG_LEVEL)         silent|error|warn|info|debug [${DEFAULTS.logLevel}]
  --help                                               show this message

Every listener also answers GET /health with a JSON status.
`;
