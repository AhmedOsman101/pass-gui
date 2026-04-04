import { os } from "@neutralinojs/lib";
import { ErrFromUnknown, Ok, type Result } from "lib-result";

/**
 * Expands the tilde (~) character at the start of a path to the user's home
 * directory.
 */
function expandTilde(path: string, homeDir: string): string {
  return path.replace(/^~(?=[/\\]|$)/, homeDir);
}

/**
 * Resolves a user-provided path into an absolute path when it starts with a
 * tilde.
 */
async function resolveUserPath(path: string): Promise<Result<string>> {
  if (!path.startsWith("~")) return Ok(path);

  try {
    const homeDir = await getHomeDir();
    return Ok(expandTilde(path, homeDir));
  } catch (error) {
    return ErrFromUnknown(error);
  }
}

/**
 * Resolves the user's home directory based on the current OS.
 * Uses $HOME on Unix and $USERPROFILE on Windows.
 * Throws if the directory cannot be resolved (critical failure).
 */
async function getHomeDir(): Promise<string> {
  switch (window.NL_OS) {
    case "Linux":
    case "Darwin":
    case "FreeBSD": {
      const home = await os.getEnv("HOME");
      if (!home) {
        throw new Error(
          "Unable to locate home directory. Please set the HOME environment variable."
        );
      }
      return home;
    }
    case "Windows": {
      const home = await os.getEnv("USERPROFILE");
      if (!home) {
        throw new Error(
          "Unable to locate home directory. Please set the USERPROFILE environment variable."
        );
      }
      return home;
    }
    default:
      throw new Error(
        "Unable to locate home directory. Please set the HOME (Unix) or USERPROFILE (Windows) environment variable."
      );
  }
}

export default { expandTilde, resolveUserPath, getHomeDir };
