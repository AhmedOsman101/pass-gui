import { filesystem } from "@neutralinojs/lib";
import { ErrFromObject, ErrFromUnknown } from "lib-result";

async function createDir(path: string) {
  try {
    await filesystem.createDirectory(path);
  } catch (e) {
    // biome-ignore lint/suspicious/noExplicitAny: Error types are unknown
    const error: any = e;
    if (error?.code === "NE_FS_DIRCRER") {
      return ErrFromObject({
        message: error?.message,
        type: "DirectoryCreationFailed",
        code: error?.code,
        path,
      });
    }

    return ErrFromUnknown(e);
  }
}

const fs = { createDir };

export { fs };
