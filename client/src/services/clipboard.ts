import { clipboard as neuClipboard } from "@neutralinojs/lib";
import { Err, Ok, type Result, wrapAsync } from "lib-result";
import { Logger } from "@/lib/logger";
import type { ClipboardAction } from "@/types/entries";
import { Config } from "./config";

/**
 * Error thrown by `Clipboard.readText()`.
 * Carries the underlying cause for debugging — the OS-level failure
 * that prevented reading the clipboard.
 */
class ClipboardReadError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
  }
}

/**
 * Error thrown by `Clipboard.writeText()` / `Clipboard.writeWithTimeout()`.
 * Captures the target clipboard selection so callers can show
 * a precise message ("primary" vs "clipboard") and the underlying
 * cause for logging.
 */
class ClipboardWriteError extends Error {
  public selection: string;
  constructor(selection: string, message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.selection = selection;
  }
}

/**
 * Error thrown by `Clipboard.clear()`.
 * Captures the underlying cause for logging.
 */
class ClipboardClearError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
  }
}

/**
 * Service for clipboard operations.
 * Wraps NeutralinoJS's native clipboard API which talks directly to the OS
 * clipboard — no browser sandbox restrictions.
 *
 * All methods return Result types — never throws.
 *
 * **NeutralinoJS limitation:** The C++ controller always reports success
 * for `writeText` — even if the clipboard is locked by another process.
 * The return value from `clip::set_text()` is ignored.
 *
 * Auto-clear timers are owned by the Pinia store, which consumes a
 * `ClipboardAction.expiresAt` from `writeWithTimeout()` and calls
 * `clear()` when the timer fires.
 */
class Clipboard {
  /**
   * Reads the current clipboard text content.
   * Returns empty string `""` if clipboard is empty or has no text format.
   */
  static async readText(): Promise<Result<string, ClipboardReadError>> {
    const result = await wrapAsync(neuClipboard.readText);
    if (result.isError()) {
      await Logger.error(`clipboard.readText failed: ${result.error.message}`);
      return Err(new ClipboardReadError(result.error.message, result.error));
    }
    return Ok(result.ok);
  }

  /**
   * Writes text to the clipboard. The copy **stays** until something
   * else overwrites it — the default: no config read, no timer.
   */
  static async writeText(
    text: string
  ): Promise<Result<void, ClipboardWriteError>> {
    const result = await wrapAsync(async () => {
      await neuClipboard.writeText(text);
    });

    if (result.isError()) {
      await Logger.error(`clipboard.writeText failed: ${result.error.message}`);
      return Err(
        new ClipboardWriteError("clipboard", result.error.message, result.error)
      );
    }

    return Ok(undefined);
  }

  /**
   * Writes a secret to the clipboard and returns timer metadata.
   *
   * The caller passes the raw secret to write. This method reads
   * `clipboard.clear_after_seconds` and `clipboard.selection` from config,
   * writes to the OS clipboard, and returns a `ClipboardAction` with
   * the expiration timestamp. Use `writeText()` for content that must
   * stay (Guide install commands and anything non-secret).
   *
   * @param secret - The text to write to the clipboard (usually a password).
   * @param entryPath - Store-relative path of the entry being copied.
   */
  static async writeWithTimeout(
    secret: string,
    entryPath: string
  ): Promise<Result<ClipboardAction, ClipboardWriteError>> {
    const configResult = await Config.load();
    if (configResult.isError()) {
      await Logger.error(
        `clipboard.writeWithTimeout failed: ${configResult.error.message}`
      );
      return Err(
        new ClipboardWriteError(
          "clipboard",
          configResult.error.message,
          configResult.error
        )
      );
    }

    const selection = configResult.ok.data.clipboard?.selection ?? "clipboard";
    const clearSeconds =
      configResult.ok.data.clipboard?.clear_after_seconds ?? 45;

    const result = await wrapAsync(async () => {
      await neuClipboard.writeText(secret);

      return {
        path: entryPath,
        selection,
        timerSeconds: clearSeconds,
        expiresAt: Date.now() + clearSeconds * 1000,
      };
    });

    if (result.isError()) {
      await Logger.error(
        `clipboard.writeWithTimeout failed: ${result.error.message}`
      );
      return Err(
        new ClipboardWriteError(selection, result.error.message, result.error)
      );
    }
    return Ok(result.ok);
  }

  /**
   * Clears the clipboard unconditionally.
   * Does not check whether the current content matches what we copied.
   * The Pinia store calls this when the auto-clear timer fires.
   */
  static async clear(): Promise<Result<void, ClipboardClearError>> {
    const result = await wrapAsync(neuClipboard.clear);
    return result
      .map(() => undefined)
      .mapErr(e => new ClipboardClearError(e.message, e));
  }
}

export {
  Clipboard,
  ClipboardClearError,
  ClipboardReadError,
  ClipboardWriteError,
};
