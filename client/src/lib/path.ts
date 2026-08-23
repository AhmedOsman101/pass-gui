import { type KnownPath, os } from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result, wrapAsync } from "lib-result";
import { Logger } from "@/lib/logger";

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
    await Logger.error(`resolveUserPath("${path}"): ${homeDir.error.message}`);
    return Err(homeDir.error);
  }

  return Ok(expandTilde(path, homeDir.ok));
}

let cachedHomeDir: string | undefined;

/**
 * Resolves the requested platform-specific directory.
 * Wraps os.getPath("...") from NeutralinoJS.
 */
async function getKnownPath(path: KnownPath): Promise<Result<string>> {
  return await wrapAsync(async () => await os.getPath(path));
}

/** Resolves the user's home directory using NeutralinoJS os.getPath("home"). */
async function getHomeDir(): Promise<Result<string>> {
  if (cachedHomeDir !== undefined) return Ok(cachedHomeDir);

  const home = await getKnownPath("home");
  if (home.isError()) {
    return ErrFromText(
      `Unable to locate home directory: ${home.error.message}`
    );
  }

  cachedHomeDir = home.ok;
  return home;
}

/**
 * Returns the system root path based on the detected OS.
 * Uses `window.NL_OS` injected by Neutralino at runtime.
 */
function getSystemRoot(): string {
  return window.NL_OS === "Windows" ? "C:\\" : "/";
}

export default {
  expandTilde,
  resolveUserPath,
  getHomeDir,
  getKnownPath,
  getSystemRoot,
};
