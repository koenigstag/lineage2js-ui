#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { ConfigError, loadConfig, USAGE } from "./config.js";
import { createLogger } from "./logger.js";
import { startProxy } from "./server.js";

export { loadConfig, parseRoute, parseTargetPattern, isTargetAllowed } from "./config.js";
export type { ProxyConfig, StaticRoute, TargetPattern } from "./config.js";
export { startProxy, parseDynamicTarget } from "./server.js";
export type { ProxyServer } from "./server.js";
export { PacketFramer } from "./framer.js";
export { createLogger } from "./logger.js";
export type { Logger, LogLevel } from "./logger.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }

  const config = loadConfig(process.env, argv);
  const logger = createLogger(config.logLevel, "proxy");

  const server = await startProxy(config, logger);

  for (const route of config.routes) {
    logger.info(`ws://${config.host}:${route.listenPort}  ->  tcp://${route.targetHost}:${route.targetPort}`);
  }
  if (config.dynamicPort !== undefined) {
    logger.info(
      `ws://${config.host}:${config.dynamicPort}/<host>/<port>  ->  tcp://<host>:<port> ` +
        `(allowed: ${config.allowedTargets.map((t) => `${t.host}:${t.port}`).join(", ")})`
    );
  }
  logger.info(`framing=${config.framing}, listening on ${server.ports.length} port(s)`);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);
    server.close().then(
      () => process.exit(0),
      (err) => {
        logger.error("Failed to shut down cleanly", err);
        process.exit(1);
      }
    );
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Only run the CLI when this module *is* the process entrypoint -- importing
// it as a library (see the exports above) must not start listening.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    if (err instanceof ConfigError) {
      console.error(`Configuration error: ${err.message}`);
      process.exit(2);
    }
    console.error(err);
    process.exit(1);
  });
}
