import type { LoggerType } from "@neutralinojs/lib";
import { debug } from "@neutralinojs/lib";

/**
 * LoggerType values, hardcoded. The lib's .d.ts declares the enum but the
 * CJS runtime never exports it (`exports.debug` is the only debug export),
 * so any runtime reference to LoggerType is `undefined`.
 */
const LEVEL: Record<string, LoggerType> = {
  INFO: "INFO" as LoggerType,
  WARNING: "WARNING" as LoggerType,
  ERROR: "ERROR" as LoggerType,
  DEBUG: "DEBUG" as LoggerType,
};

function stringify(item: unknown): string {
  if (typeof item === "string") return item;
  if (item instanceof Error) return `${item.name}: ${item.message}`;
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function join(items: unknown[]): string {
  return items.map(stringify).join(" ");
}

/**
 * App-wide logger backed by Neutralino's native logger.
 * `debug.log` writes to the Neutralino terminal/OS log with a level prefix,
 * so errors surface even when the Result chain swallows them.
 * Variadic: accepts any number of items (strings, Errors, objects) per call.
 * Async: `debug.log` returns a Promise<void>, so callers must await.
 */
class Logger {
  static async info(...items: unknown[]): Promise<void> {
    await debug.log(join(items), LEVEL.INFO);
  }

  static async warn(...items: unknown[]): Promise<void> {
    await debug.log(join(items), LEVEL.WARNING);
  }

  static async error(...items: unknown[]): Promise<void> {
    await debug.log(join(items), LEVEL.ERROR);
  }

  static async debug(...items: unknown[]): Promise<void> {
    await debug.log(join(items), LEVEL.DEBUG);
  }
}

export { Logger };
