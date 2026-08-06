/**
 * Tiny structured logger for the browser (Part 12). Streams are JSON-ish single
 * lines; in production this is the seam where remote telemetry is attached.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const IS_DEV = process.env.NODE_ENV === "development";

function write(level: LogLevel, event: string, data?: Record<string, unknown>) {
  if (!IS_DEV && level === "debug") return;
  const line = { ts: new Date().toISOString(), level, event, ...(data ?? {}) };
  if (level === "error") console.error(JSON.stringify(line));
  else if (level === "warn") console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

export const logger = {
  isEnabled(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= (IS_DEV ? LEVEL_ORDER.debug : LEVEL_ORDER.info);
  },
  debug: (event: string, data?: Record<string, unknown>) => write("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
};
