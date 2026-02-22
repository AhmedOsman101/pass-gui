import {
  type FileReaderOptions,
  filesystem,
  type Stats,
} from "@neutralinojs/lib";
import { Err, ErrFromUnknown, Ok, type Result, wrapAsync } from "lib-result";
import {
  DirectoryCreationError,
  NEU_ERROR_CODES,
  NEU_ERROR_CODES_MAP,
  type NeuErrorCode,
} from "@/lib/errors";
import type { NeuErrorObj } from "@/types";

/**
 * Filesystem abstraction layer wrapping NeutralinoJS filesystem operations.
 * All methods return Result types for safe error handling.
 */
class fs {
  /**
   * Creates a directory at the specified path.
   * Returns a DirectoryCreationError on failure for detailed error context.
   */
  static async mkdir(
    path: string
  ): Promise<Result<boolean, DirectoryCreationError | Error>> {
    try {
      await filesystem.createDirectory(path);
      return Ok(true);
    } catch (e) {
      const err = e as NeuErrorObj;
      if (err?.code === NEU_ERROR_CODES_MAP.DirectoryCreationFailed) {
        const errorCode = err.code as NeuErrorCode;
        return Err(
          new DirectoryCreationError(
            NEU_ERROR_CODES[errorCode],
            errorCode,
            path,
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
    const res = await fs.getStats(path);
    if (res.isOk()) return Ok(res.ok.isFile || res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Checks if the path points to a regular file.
   */
  static async isFile(path: string): Promise<Result<boolean>> {
    const res = await fs.getStats(path);
    if (res.isOk()) return Ok(res.ok.isFile);
    return Err(res.error);
  }

  /**
   * Checks if the path points to a directory.
   */
  static async isDirectory(path: string): Promise<Result<boolean>> {
    const res = await fs.getStats(path);
    if (res.isOk()) return Ok(res.ok.isDirectory);
    return Err(res.error);
  }

  /**
   * Gets file/directory statistics (size, dates, type, etc.).
   */
  static async getStats(path: string): Promise<Result<Stats>> {
    return await wrapAsync(async () => await filesystem.getStats(path));
  }

  /**
   * Reads file contents with optional position and size parameters.
   * Returns string content (text mode).
   */
  static async readFile(
    path: string,
    options: FileReaderOptions
  ): Promise<Result<string>> {
    return await wrapAsync(
      async () => await filesystem.readFile(path, options)
    );
  }

  /**
   * Normalizes a path, resolving . and .. segments and symlinks.
   */
  static async getNormalizedPath(path: string): Promise<Result<string>> {
    return await wrapAsync(
      async () => await filesystem.getNormalizedPath(path)
    );
  }
}

export { fs };
