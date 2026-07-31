import {
  type DirectoryEntry,
  type DirectoryReaderOptions,
  type FileReaderOptions,
  filesystem,
  type PathParts,
  type Stats,
} from "@neutralinojs/lib";
import ignore from "ignore";
import { Err, ErrFromUnknown, Ok, type Result, wrapAsync } from "lib-result";
import {
  DirectoryCreationError,
  FileWriteError,
  NEU_ERROR_CODES,
  NEU_ERROR_CODES_MAP,
  type NeuErrorCode,
} from "@/lib/errors";
import Path from "@/lib/path";
import type { NeuErrorObj } from "@/types";

/**
 * A directory entry with nested children — the tree form of NeutralinoJS's
 * flat `DirectoryEntry[]`. Directories have `children`; files do not.
 *
 * - `entry` is the basename (e.g. `"work.gpg"`).
 * - `path` is the store-relative path (e.g. `"Email/work.gpg"`).
 * - `type` is `"FILE"` or `"DIRECTORY"`.
 */
type TreeDirectoryEntry = {
  type: "FILE" | "DIRECTORY";
  entry: string;
  /** Store-relative path — computed by stripping the root prefix. */
  path: string;
  children?: TreeDirectoryEntry[];
};

/**
 * Converts a flat `DirectoryEntry[]` (from NeutralinoJS) into a nested tree.
 *
 * NeutralinoJS `readDirectory({ recursive: true })` returns a flat array where
 * each entry has `entry` (basename), `path` (full absolute path), and `type`.
 * Hierarchy is derived by stripping the root path prefix and splitting on `/`.
 *
 * Each node gets a `path` field — the store-relative path computed from the
 * full absolute path minus the root prefix.
 *
 * @example
 * ```ts
 * // Input (rootPath = "/store"):
 * // [{ entry: "Email", path: "/store/Email", type: "DIRECTORY" },
 * //  { entry: "work.gpg", path: "/store/Email/work.gpg", type: "FILE" }]
 * //
 * // Output:
 * // [{ entry: "Email", path: "Email", type: "DIRECTORY", children: [
 * //    { entry: "work.gpg", path: "Email/work.gpg", type: "FILE" }
 * // ]}]
 * ```
 */
function buildTree(
  flat: DirectoryEntry[],
  rootPath: string
): TreeDirectoryEntry[] {
  const root: TreeDirectoryEntry[] = [];
  const normalizedRoot = rootPath.endsWith("/") ? rootPath : `${rootPath}/`;

  for (const item of flat) {
    const relativePath = item.path.startsWith(normalizedRoot)
      ? item.path.slice(normalizedRoot.length)
      : item.entry;
    const segments = relativePath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const name = segments[i] as string;
      const isLast = i === segments.length - 1;
      const existing = current.find(n => n.entry === name);

      if (existing) {
        if (!existing.children) existing.children = [];
        current = existing.children;
      } else {
        const node: TreeDirectoryEntry = {
          type: isLast ? (item.type as "FILE" | "DIRECTORY") : "DIRECTORY",
          entry: name,
          path: relativePath
            .split("/")
            .filter(Boolean)
            .slice(0, i + 1)
            .join("/"),
          children: isLast && item.type === "FILE" ? undefined : [],
        };
        current.push(node);
        if (node.children) current = node.children;
      }
    }
  }

  return root;
}

/**
 * Creates an async ignore filter from gitignore-style patterns.
 *
 * Returns a function that takes an **absolute** path and returns `true`
 * if the entry should be **kept** (not ignored). Internally converts
 * to a relative path via `fs.relativePath()` before calling `ig.ignores()`.
 *
 * Caches relative path lookups — entries sharing the same parent directory
 * reuse the same computed prefix instead of re-parsing.
 *
 * Supports the full `.gitignore` syntax: `*`, `**`, `!` negation,
 * `#` comments, `/` anchoring, trailing `/` for directories.
 *
 * @example
 * ```ts
 * const keep = await makeIgnoreFilter("/store", ["*.log", "temp/"]);
 * keep("/store/debug.log");  // false — ignored
 * keep("/store/work.gpg");   // true  — kept
 * ```
 */
function makeIgnoreFilter(
  baseDir: string,
  patterns: string[]
): (absolutePath: string) => Promise<boolean> {
  const ig = ignore().add(patterns);
  const cache = new Map<string, string>();

  return async (absolutePath: string): Promise<boolean> => {
    let rel = cache.get(absolutePath);
    if (rel === undefined) {
      rel = await Filesystem.relativePath(absolutePath, baseDir);
      cache.set(absolutePath, rel);
    }
    const normalized = rel.startsWith("/") ? rel.slice(1) : rel;
    return !ig.ignores(normalized);
  };
}

/**
 * Filesystem abstraction layer wrapping NeutralinoJS filesystem operations.
 * All methods return Result types for safe error handling.
 */
class Filesystem {
  private static async resolvePath(path: string): Promise<Result<string>> {
    return await Path.resolveUserPath(path);
  }

  /**
   * Creates a directory at the specified path.
   * Returns a DirectoryCreationError on failure for detailed error context.
   */
  static async mkdir(
    path: string
  ): Promise<Result<boolean, DirectoryCreationError | Error>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    // Skip creation if it already exists.
    if ((await Filesystem.isDirectory(resolvedPath.ok)).unwrapOr(false)) {
      return Ok(true);
    }

    try {
      await filesystem.createDirectory(resolvedPath.ok);
      return Ok(true);
    } catch (e) {
      const err = e as NeuErrorObj;
      if (err?.code === NEU_ERROR_CODES_MAP.DirectoryCreationFailed) {
        const errorCode = err.code as NeuErrorCode;
        return Err(
          new DirectoryCreationError(
            NEU_ERROR_CODES[errorCode],
            errorCode,
            resolvedPath.ok,
            err.message
          )
        );
      }

      return ErrFromUnknown(e);
    }
  }

  /**
   * Checks if a file or directory exists at the given path.
   */
  static async exists(path: string): Promise<Result<boolean>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const res = await Filesystem.getStats(resolvedPath.ok);
    if (res.isOk()) return Ok(res.ok.isFile || res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Checks if the path points to a regular file.
   */
  static async isFile(path: string): Promise<Result<boolean>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const res = await Filesystem.getStats(resolvedPath.ok);
    // Everything that's not a directory is a file.
    // NOTE: isFile property checks only for regular files.
    if (res.isOk()) return Ok(!res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Checks if the path points to a directory.
   */
  static async isDirectory(path: string): Promise<Result<boolean>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const res = await Filesystem.getStats(resolvedPath.ok);
    if (res.isOk()) return Ok(res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Gets file/directory statistics (size, dates, type, etc.).
   */
  static async getStats(path: string): Promise<Result<Stats>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    return await wrapAsync(
      async () => await filesystem.getStats(resolvedPath.ok)
    );
  }

  /**
   * Reads file contents with optional position and size parameters.
   * Returns string content (text mode).
   */
  static async readFile(
    path: string,
    options?: FileReaderOptions
  ): Promise<Result<string>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    return await wrapAsync(
      async () => await filesystem.readFile(resolvedPath.ok, options)
    );
  }

  /**
   * Normalizes a path, resolving . and .. segments and symlinks.
   */
  static async getNormalizedPath(path: string): Promise<Result<string>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    return await wrapAsync(
      async () => await filesystem.getNormalizedPath(resolvedPath.ok)
    );
  }

  /**
   * Joins multiple path segments into a single normalized path.
   * Uses the OS-specific path separator.
   */
  static async join(...paths: string[]): Promise<string> {
    return await filesystem.getJoinedPath(...paths);
  }

  /**
   * Parses a given path and returns its parts.
   * Includes root, relative path, filename, extension, etc.
   */
  static async getPathParts(path: string): Promise<Result<PathParts>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    return await wrapAsync(
      async () => await filesystem.getPathParts(resolvedPath.ok)
    );
  }

  /**
   * Returns a relative path from `base` to `absolutePath`.
   * Delegates to NeutralinoJS `filesystem.getRelativePath`.
   */
  static async relativePath(
    absolutePath: string,
    base: string
  ): Promise<string> {
    return await filesystem.getRelativePath(absolutePath, base);
  }

  /**
   * Reads a directory's contents.
   *
   * By default returns a nested tree (`TreeDirectoryEntry[]`). Pass
   * `flat: true` to get NeutralinoJS's native flat array instead.
   *
   * Pass `ignore` with gitignore-style patterns to exclude entries:
   * - `*` matches anything except `/`
   * - `**` matches everything including `/`
   * - `!pattern` negates (un-ignores)
   * - `/prefix` anchors to root
   * - `suffix/` only matches directories
   *
   * @example
   * ```ts
   * // Tree with ignore:
   * fs.readDirectory("/store", {
   *   recursive: true,
   *   ignore: ["*.log", "temp/"]
   * });
   *
   * // Flat list:
   * fs.readDirectory("/store", { recursive: true, flat: true });
   * ```
   */
  static async readDirectory(
    path: string,
    options: DirectoryReaderOptions & { flat: true; ignore?: string[] }
  ): Promise<Result<DirectoryEntry[]>>;
  static async readDirectory(
    path: string,
    options?: DirectoryReaderOptions & { ignore?: string[] }
  ): Promise<Result<TreeDirectoryEntry[]>>;
  static async readDirectory(
    path: string,
    options?: DirectoryReaderOptions & {
      ignore?: string[];
      flat?: boolean;
    }
  ): Promise<Result<TreeDirectoryEntry[] | DirectoryEntry[]>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const flatResult = await wrapAsync(
      async () => await filesystem.readDirectory(resolvedPath.ok, options)
    );
    if (flatResult.isError()) return Err(flatResult.error);

    let entries = flatResult.ok;

    // Apply ignore filter before tree building
    // Fast path: compute relative paths locally via string slicing.
    // No IPC calls — NeutralinoJS already gave us the absolute paths.
    if (options?.ignore && options.ignore.length > 0) {
      const ig = ignore().add(options.ignore);
      const base = resolvedPath.ok.endsWith("/")
        ? resolvedPath.ok
        : `${resolvedPath.ok}/`;
      entries = entries.filter(item => {
        const rel = item.path.startsWith(base)
          ? item.path.slice(base.length)
          : item.entry;
        return !ig.ignores(rel);
      });
    }

    if (options?.flat) {
      return Ok(entries);
    }

    return Ok(buildTree(entries, resolvedPath.ok));
  }

  /**
   * Writes content to a file at the specified path.
   * Creates the file if it doesn't exist, overwrites if it does.
   * Returns a FileWriteError on failure.
   */
  static async writeFile(
    path: string,
    data: string
  ): Promise<Result<boolean, FileWriteError | Error>> {
    const resolvedPath = await Filesystem.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    try {
      await filesystem.writeFile(resolvedPath.ok, data);
      return Ok(true);
    } catch (e) {
      const err = e as NeuErrorObj;
      if (err?.code === "NE_FS_FILWRER") {
        const errorCode = err.code as NeuErrorCode;
        return Err(
          new FileWriteError(
            NEU_ERROR_CODES[errorCode],
            errorCode,
            resolvedPath.ok,
            err.message
          )
        );
      }
      return ErrFromUnknown(e);
    }
  }
}

const Fs = Filesystem;

export { Fs, makeIgnoreFilter, type TreeDirectoryEntry };
