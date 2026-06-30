import { clipboard as neuClipboard } from "@neutralinojs/lib";
import { Err, type Result, wrapAsync } from "lib-result";
import { ClipboardError } from "@/lib/errors";
import type { ClipboardAction } from "@/types/entries";
import { Config } from "./config";

/**
 * Service for clipboard operations.
 * Wraps NeutralinoJS's native clipboard API which talks directly to the OS
 * clipboard — no browser sandbox restrictions.
 *
 * All methods return Result types — never throws.
 * Does NOT manage auto-clear timers. The Phase 04 Pinia store consumes
 * `ClipboardAction.expiresAt` and calls `clear()` when the timer fires.
 */
class Clipboard {
  /**
   * Reads the current clipboard text content.
   * Returns empty string `""` if clipboard is empty or has no text format.
   */
  static async readText(): Promise<Result<string, ClipboardError>> {
    const result = await wrapAsync(neuClipboard.readText);
    return result.mapErr(e => new ClipboardError("clipboard", e.message));
  }

  /**
   * Writes a secret to the clipboard and returns timer metadata.
   *
   * The caller (EntriesService or UI) passes the raw secret to write.
   * This method reads `clipboard.clear_after_seconds` and
   * `clipboard.selection` from config, writes to the OS clipboard,
   * and returns a `ClipboardAction` with the expiration timestamp.
   *
   * **NeutralinoJS limitation:** The C++ controller always reports success
   * for `writeText` — even if the clipboard is locked by another process.
   * The return value from `clip::set_text()` is ignored. Only JS-side
   * argument validation errors (`NE_RT_NATRTER`) are caught here.
   *
   * @param secret - The text to write to the clipboard (usually a password).
   * @param entryPath - Store-relative path of the entry being copied.
   */
  static async writeText(
    secret: string,
    entryPath: string
  ): Promise<Result<ClipboardAction, ClipboardError>> {
    const configResult = await Config.load();
    if (configResult.isError()) {
      return Err(new ClipboardError("clipboard", configResult.error.message));
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

    return result.mapErr(e => new ClipboardError(selection, e.message));
  }

  /**
   * Clears the clipboard unconditionally.
   * Does not check whether the current content matches what we copied.
   * The Phase 04 Pinia store calls this when the auto-clear timer fires.
   */
  static async clear(): Promise<Result<void, ClipboardError>> {
    const result = await wrapAsync(neuClipboard.clear);
    return result.mapErr(e => new ClipboardError("clipboard", e.message));
  }
}

export { Clipboard };
