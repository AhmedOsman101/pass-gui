import {
  type FileReaderOptions,
  filesystem,
  type PathParts,
  type Stats,
} from "@neutralinojs/lib";
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
 * Filesystem abstraction layer wrapping NeutralinoJS filesystem operations.
 * All methods return Result types for safe error handling.
 */
class fs {
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
    const resolvedPath = await fs.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

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
    const resolvedPath = await fs.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const res = await fs.getStats(resolvedPath.ok);
    if (res.isOk()) return Ok(res.ok.isFile || res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Checks if the path points to a regular file.
   */
  static async isFile(path: string): Promise<Result<boolean>> {
    const resolvedPath = await fs.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const res = await fs.getStats(resolvedPath.ok);
    if (res.isOk()) return Ok(res.ok.isFile);
    return Err(res.error);
  }

  /**
   * Checks if the path points to a directory.
   */
  static async isDirectory(path: string): Promise<Result<boolean>> {
    const resolvedPath = await fs.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    const res = await fs.getStats(resolvedPath.ok);
    if (res.isOk()) return Ok(res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Gets file/directory statistics (size, dates, type, etc.).
   */
  static async getStats(path: string): Promise<Result<Stats>> {
    const resolvedPath = await fs.resolvePath(path);
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
    const resolvedPath = await fs.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    return await wrapAsync(
      async () => await filesystem.readFile(resolvedPath.ok, options)
    );
  }

  /**
   * Normalizes a path, resolving . and .. segments and symlinks.
   */
  static async getNormalizedPath(path: string): Promise<Result<string>> {
    const resolvedPath = await fs.resolvePath(path);
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
    const resolvedPath = await fs.resolvePath(path);
    if (resolvedPath.isError()) return Err(resolvedPath.error);

    return await wrapAsync(
      async () => await filesystem.getPathParts(resolvedPath.ok)
    );
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
    const resolvedPath = await fs.resolvePath(path);
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

export { fs };
