export const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  child(scope: string): Logger;
}

export function createLogger(level: LogLevel, scope = ""): Logger {
  const threshold = LOG_LEVELS.indexOf(level);
  const prefix = scope ? `[${scope}]` : "";

  const log = (severity: LogLevel, sink: (...args: unknown[]) => void) => {
    return (...args: unknown[]): void => {
      if (LOG_LEVELS.indexOf(severity) > threshold) return;
      sink(`${new Date().toISOString()} ${severity.toUpperCase().padEnd(5)}${prefix}`, ...args);
    };
  };

  return {
    error: log("error", console.error),
    warn: log("warn", console.warn),
    info: log("info", console.log),
    debug: log("debug", console.log),
    child: (childScope: string) => createLogger(level, scope ? `${scope}:${childScope}` : childScope),
  };
}
