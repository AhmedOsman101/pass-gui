import { ErrFromText, Ok, type Result } from "lib-result";
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
 * Implements the MS CommandLineToArgvW rules (as .NET's argument escaper
 * and Python's list2cmdline do): a run of n backslashes before a quote
 * becomes 2n+1 backslashes + `"` (so the quote is escaped, not a
 * boundary); runs not followed by a quote are literal; newlines are
 * rejected. Returns empty string for arguments containing CR/LF.
 */
function quoteForWindows(arg: string): string {
  if (/[\r\n]/.test(arg)) return "";

  let result = "";
  let backslashes = 0;

  for (const char of arg) {
    if (char === "\\") {
      backslashes++;
      continue;
    }

    if (char === '"') {
      result += "\\".repeat(2 * backslashes + 1);
      result += '"';
      backslashes = 0;
      continue;
    }

    result += "\\".repeat(backslashes);
    backslashes = 0;
    result += char;
  }

  // Trailing run sits before the closing quote — double it so the
  // parser reads n literal backslashes and treats the quote as the
  // argument boundary.
  result += "\\".repeat(2 * backslashes);

  return `"${result}"`;
}

/**
 * Builds a shell command string with properly quoted arguments.
 * The command is quoted on POSIX (defense-in-depth against shell injection).
 * Arguments are quoted on all platforms.
 * Uses POSIX quoting for Linux/macOS and Windows quoting for Windows.
 */
function buildShellCommand(
  cmd: string,
  args: Stringifiable[],
  os: OsType
): string {
  const quotedCmd = os === "windows" ? cmd : quoteForPosix(cmd);
  const quotedArgs = args.map(arg => {
    const strArg = String(arg);
    return os === "windows" ? quoteForWindows(strArg) : quoteForPosix(strArg);
  });

  return quotedArgs.length > 0
    ? `${quotedCmd} ${quotedArgs.join(" ")}`
    : quotedCmd;
}

/**
 * Validates that a command name is safe to pass through the shell.
 * Since commands are single-quote wrapped, only a single quote could break out.
 * Rejects empty strings, null bytes, leading dashes, and control characters.
 */
function validateCommand(cmd: string): Result<string> {
  if (!cmd) return ErrFromText("Command name is empty");

  if (cmd.includes("'")) {
    return ErrFromText(
      `Command "${cmd}" contains a single quote (unsafe for shell quoting)`
    );
  }
  if (cmd.includes("\0") || cmd.includes("\n") || cmd.includes("\r")) {
    return ErrFromText(
      "Command contains one or more invalid characters (\\0, \\n, \\r)"
    );
  }
  if (cmd.startsWith("-")) {
    return ErrFromText(`Command "${cmd}" starts with a dash`);
  }
  return Ok(cmd);
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
 * Checks if a path contains directory traversal patterns — verbatim port
 * of pass's own `check_sneaky_paths` (docs/external-resources/pass/pass.sh):
 * purely lexical on the raw string. OS normalization is deliberately NOT
 * used: it can silently resolve a traversal away (hiding it from this
 * check), and a normalization failure must never fail open on a security
 * boundary.
 */
function checkSneakyPath(path: string): boolean {
  return (
    path.endsWith("/..") ||
    path.startsWith("../") ||
    path.includes("/../") ||
    path === ".."
  );
}

/**
 * Validates a path for security before use in commands.
 * Checks for invalid characters and directory traversal attacks.
 */
function validatePath(path: Stringifiable): Result<string> {
  const strPath = String(path);

  const invalidChars = validateArgument(strPath);
  if (invalidChars.isError()) return invalidChars;

  if (checkSneakyPath(strPath)) {
    return ErrFromText(
      "You've attempted to pass a sneaky path to pass. Go home."
    );
  }

  return Ok(strPath);
}

export {
  buildShellCommand,
  checkSneakyPath,
  type OsType,
  quoteForPosix,
  quoteForWindows,
  validateArgument,
  validateCommand,
  validatePath,
};
