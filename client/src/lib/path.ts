import { os } from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result } from "lib-result";

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

  const homeDir = await getHomeDir();
  if (homeDir.isError()) {
    return Err(homeDir.error);
  }

  return Ok(expandTilde(path, homeDir.ok));
}

/**
 * Resolves the user's home directory based on the current OS.
 * Uses $HOME on Unix and $USERPROFILE on Windows.
 */
async function getHomeDir(): Promise<Result<string>> {
  switch (window.NL_OS) {
    case "Linux":
    case "Darwin":
    case "FreeBSD": {
      const home = await os.getEnv("HOME");
      if (!home) {
        return ErrFromText(
          "Unable to locate home directory. Please set the HOME environment variable."
        );
      }
      return Ok(home);
    }
    case "Windows": {
      const home = await os.getEnv("USERPROFILE");
      if (!home) {
        return ErrFromText(
          "Unable to locate home directory. Please set the USERPROFILE environment variable."
        );
      }
      return Ok(home);
    }
    default:
      return ErrFromText(
        "Unable to locate home directory. Please set the HOME (Unix) or USERPROFILE (Windows) environment variable."
      );
  }
}

export default { expandTilde, resolveUserPath, getHomeDir };
