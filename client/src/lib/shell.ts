import { ErrFromText, Ok, type Result } from "lib-result";
import { fs } from "@/services/filesystem";
import type { Stringifiable } from "@/types";

type OsType = "posix" | "windows";

/**
 * Quotes a string for safe use in POSIX shell commands.
 * Uses single quotes with proper escaping for embedded single quotes.
 */
function quoteForPosix(arg: string): string {
  if (arg.includes("'")) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return `'${arg}'`;
}

/**
 * Quotes a string for safe use in Windows CMD/PowerShell.
 * Handles backslashes, double quotes, and rejects newlines.
 * Returns empty string for arguments containing carriage returns or newlines.
 */
function quoteForWindows(arg: string): string {
  let result = "";
  let prevChar = "";

  for (const char of arg) {
    switch (char) {
      case '"':
        result += '""';
        prevChar = char;
        break;
      case "\\":
        result += "\\";
        prevChar = char;
        break;
      case "\r":
      case "\n":
        return "";
      default:
        if (prevChar === "\\") {
          result += "\\";
        }
        result += char;
        prevChar = char;
    }
  }

  return `"${result}"`;
}

/**
 * Builds a shell command string with properly quoted arguments.
 * Uses POSIX quoting for Linux/macOS and Windows quoting for Windows.
 */
function buildShellCommand(
  cmd: string,
  args: Stringifiable[],
  os: OsType
): string {
  const quotedArgs = args.map(arg => {
    const strArg = String(arg);
    return os === "windows" ? quoteForWindows(strArg) : quoteForPosix(strArg);
  });

  return quotedArgs.length > 0 ? `${cmd} ${quotedArgs.join(" ")}` : cmd;
}

/**
 * Validates that an argument doesn't contain dangerous characters.
 * Rejects null bytes, carriage returns, and newlines.
 */
function validateArgument(arg: string): Result<string> {
  if (arg.includes("\0") || arg.includes("\n") || arg.includes("\r")) {
    return ErrFromText(
      "Argument contains one or more invalid characters (\\0, \\n, \\r)"
    );
  }

  return Ok(arg);
}

/**
 * Checks if a path contains directory traversal patterns (../).
 * These could be used to escape the password store directory.
 */
async function checkSneakyPath(path: string): Promise<boolean> {
  const normalizedResult = await fs.getNormalizedPath(path);
  if (normalizedResult.isError()) {
    return false;
  }

  const normalized = normalizedResult.ok
    .replace(/\/+/g, "/")
    .replace(/\/+$/, "");

  return (
    normalized.includes("/..") ||
    normalized.endsWith("/..") ||
    normalized === ".." ||
    normalized.startsWith("..")
  );
}

/**
 * Validates a path for security before use in commands.
 * Checks for invalid characters and directory traversal attacks.
 */
async function validatePath(path: Stringifiable): Promise<Result<string>> {
  const strPath = String(path);

  const invalidChars = validateArgument(strPath);
  if (invalidChars.isError()) {
    return invalidChars;
  }

  const isSneaky = await checkSneakyPath(strPath);
  if (isSneaky) {
    return ErrFromText(
      "You've attempted to pass a sneaky path to pass. Go home."
    );
  }

  return Ok(strPath);
}

export {
  quoteForPosix,
  quoteForWindows,
  buildShellCommand,
  validateArgument,
  checkSneakyPath,
  validatePath,
  type OsType,
};
