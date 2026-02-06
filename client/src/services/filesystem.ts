import { filesystem } from "@neutralinojs/lib";
import { ErrFromObject, ErrFromUnknown } from "lib-result";
import { NEU_ERROR_CODES, type NeuErrorCode } from "@/lib/constants";

async function createDir(path: string) {
  try {
    await filesystem.createDirectory(path);
  } catch (e) {
    // biome-ignore lint/suspicious/noExplicitAny: Error types are unknown
    const error: any = e;
    if (error?.code === NEU_ERROR_CODES.NE_FS_DIRCRER) {
      return ErrFromObject({
        message: error?.message,
        type: NEU_ERROR_CODES[error.code as NeuErrorCode],
        code: error?.code,
        path,
      });
    }

    return ErrFromUnknown(e);
  }
}

const fs = { createDir };

export { fs };
