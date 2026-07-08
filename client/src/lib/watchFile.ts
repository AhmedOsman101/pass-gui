import { Fs } from "@/services/filesystem";

/**
 * In-memory file cache backed by mtime comparison.
 *
 * Tracks a file by path. On `check()`, checks the file's `modifiedAt`
 * timestamp — if unchanged, returns true.
 * Call `invalidate()` after writes to force a fresh read on next `get()`.
 */
interface FileCache {
  check(): Promise<boolean>;
  invalidate(): void;
}

/**
 * Lightweight mtime-based file change detector.
 *
 * Tracks a file's `modifiedAt` timestamp in memory.
 * `check()` returns `true` if the file has changed since last check
 * (or since last `invalidate()`), `false` otherwise.
 * `invalidate()` resets the cache so the next `check()` returns `true`.
 *
 * @param filePath - Absolute path to the file to watch.
 */
function watchFile(filePath: string): FileCache {
  let cachedMtime = 0;

  return {
    /**
     * Returns `true` if the file's mtime differs from the cached value
     * (i.e. the file has been modified on disk).
     */
    async check(): Promise<boolean> {
      const stats = await Fs.getStats(filePath);
      if (stats.isError()) return true;
      if (stats.ok.modifiedAt === cachedMtime) return false;
      cachedMtime = stats.ok.modifiedAt;
      return true;
    },

    /**
     * Resets the cached mtime so the next `check()` returns `true`.
     */
    invalidate(): void {
      cachedMtime = 0;
    },
  };
}

export { type FileCache, watchFile };
