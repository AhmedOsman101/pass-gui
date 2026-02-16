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

class fs {
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

  static async exists(path: string): Promise<Result<boolean>> {
    const res = await fs.getStats(path);
    if (res.isOk()) return Ok(res.ok.isFile || res.ok.isDirectory);
    return Err(res.error);
  }

  static async isFile(path: string): Promise<Result<boolean>> {
    const res = await fs.getStats(path);
    if (res.isOk()) return Ok(res.ok.isFile);
    return Err(res.error);
  }

  static async isDirectory(path: string): Promise<Result<boolean>> {
    const res = await fs.getStats(path);
    if (res.isOk()) return Ok(res.ok.isDirectory);
    return Err(res.error);
  }

  static async getStats(path: string): Promise<Result<Stats>> {
    return await wrapAsync(async () => await filesystem.getStats(path));
  }

  static async readFile(
    path: string,
    options: FileReaderOptions
  ): Promise<Result<string>> {
    return await wrapAsync(
      async () => await filesystem.readFile(path, options)
    );
  }

  static async getNormalizedPath(path: string): Promise<Result<string>> {
    return await wrapAsync(
      async () => await filesystem.getNormalizedPath(path)
    );
  }
}

export { fs };
