import { events, filesystem } from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result, wrapAsync } from "lib-result";
import { Logger } from "@/lib/logger";

type WatcherEntry = {
  watcherId: number;
  filename: string;
  changed: boolean;
  handler: (ev: CustomEvent) => void;
};

/**
 * OS-native file watcher service backed by Neutralino's filesystem.createWatcher.
 *
 * Uses inotify (Linux), kqueue/FSEvents (macOS), or ReadDirectoryChangesW (Windows).
 * Events are pushed by the OS — zero polling overhead.
 *
 * Manages multiple named watchers. Each watcher monitors a directory and
 * filters events to a specific filename.
 */
class Watcher {
  private static watchers = new Map<string, WatcherEntry>();

  /**
   * Starts watching a directory for changes to a specific file.
   * If a watcher with the same ID already exists, it is a no-op.
   *
   * @param id - Unique identifier for this watcher (e.g. "config", "store:default")
   * @param dirPath - Absolute directory path to watch
   * @param filename - Only events matching this filename trigger the changed flag
   */
  static async watch(
    id: string,
    dirPath: string,
    filename: string
  ): Promise<Result<void>> {
    if (Watcher.watchers.has(id)) return Ok(undefined);

    const result = await wrapAsync(
      async () => await filesystem.createWatcher(dirPath)
    );
    if (result.isError()) {
      await Logger.error(
        `watcher.watch("${id}") failed to create watcher for ${dirPath}: ${result.error.message}`
      );
      return ErrFromText(`Failed to create watcher for ${dirPath}`);
    }
    const watcherId = result.ok;

    const entry: WatcherEntry = {
      watcherId,
      filename,
      changed: false,
      handler: (ev: CustomEvent) => {
        const detail = ev.detail as {
          id: number;
          filename?: string;
        };
        if (detail.id === watcherId && detail.filename === filename) {
          entry.changed = true;
        }
      },
    };

    const onResult = await wrapAsync(
      async () => await events.on("watchFile", entry.handler)
    );
    if (onResult.isError()) {
      await Logger.error(
        `watcher.watch("${id}") failed to register watcher event for ${dirPath}: ${onResult.error.message}`
      );
      return ErrFromText(`Failed to register watcher event for ${dirPath}`);
    }
    Watcher.watchers.set(id, entry);
    return Ok(undefined);
  }

  /**
   * Returns true if the watched file changed since last check.
   * Resets the flag after returning true.
   */
  static hasChanged(id: string): boolean {
    const entry = Watcher.watchers.get(id);
    if (!entry) return false;
    if (entry.changed) {
      entry.changed = false;
      return true;
    }
    return false;
  }

  /**
   * Forces the changed flag to true so the next hasChanged() returns true.
   * Useful after self-inflicted writes to trigger a re-read.
   */
  static invalidate(id: string): void {
    const entry = Watcher.watchers.get(id);
    if (entry) entry.changed = true;
  }

  /**
   * Stops watching and cleans up a named watcher.
   * Always removes the entry from the local map before attempting cleanup so
   * failed cleanups don't get retried forever.
   */
  static async unwatch(id: string): Promise<Result<void>> {
    const entry = Watcher.watchers.get(id);
    if (!entry) return Ok(undefined);

    // Remove from map first — prevents retries on permanent failures.
    Watcher.watchers.delete(id);

    let lastError: string | null = null;

    const offResult = await wrapAsync(
      async () => await events.off("watchFile", entry.handler)
    );
    if (offResult.isError()) {
      lastError = `Failed to unregister watcher event for ${id}`;
    }

    // Always attempt native cleanup even if events.off failed — otherwise
    // the OS watcher leaks.
    const removeResult = await wrapAsync(
      async () => await filesystem.removeWatcher(entry.watcherId)
    );
    if (removeResult.isError()) {
      lastError = `Failed to remove watcher ${id}`;
    }

    if (lastError) return ErrFromText(lastError);
    return Ok(undefined);
  }

  /**
   * Stops all active watchers. Call during app teardown.
   * Drains all watchers regardless of individual failures — partial cleanup
   * is better than leaked OS watchers during shutdown.
   */
  static async unwatchAll(): Promise<Result<void>> {
    const ids = [...Watcher.watchers.keys()];
    let firstError: Result<void> | null = null;
    for (const id of ids) {
      const result = await Watcher.unwatch(id);
      if (result.isError() && firstError === null) {
        firstError = result;
      }
    }
    return firstError ?? Ok(undefined);
  }
}

export { Watcher };
