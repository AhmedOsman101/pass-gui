import { filesystem } from "@neutralinojs/lib";
import { Err, ErrFromUnknown } from "lib-result";
import { NEU_ERROR_CODES, type NeuErrorCode } from "@/lib/constants";
import { DirectoryCreationError } from "@/lib/errors";

async function mkdir(path: string) {
  try {
    await filesystem.createDirectory(path);
  } catch (e) {
    // biome-ignore lint/suspicious/noExplicitAny: Error types are unknown
    const error: any = e;
    if (error?.code === NEU_ERROR_CODES.NE_FS_DIRCRER) {
      return Err(
        new DirectoryCreationError(
          NEU_ERROR_CODES[error.code as NeuErrorCode],
          error?.code,
          path,
          error?.message
        )
      );
    }

    return ErrFromUnknown(e);
  }
}

const fs = { mkdir };

export { fs };
