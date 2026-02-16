import { ErrFromText, Ok, type Result } from "lib-result";
import type { Stringifiable } from "@/types";

type OsType = "posix" | "windows";

function quoteForPosix(arg: string): string {
  if (arg.includes("'")) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return `'${arg}'`;
}

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

function validateArgument(arg: string): Result<string> {
  if (arg.includes("\0") || arg.includes("\n") || arg.includes("\r")) {
    return ErrFromText("Argument contains one or more invalid characters (\\0, \\n, \\r)");
  }

  return Ok(arg);
}

function checkSneakyPath(path: string): boolean {
  const normalized = path.replace(/\/+/g, "/").replace(/\/+$/, "");

  return (
    normalized.includes("/..") ||
    normalized.endsWith("/..") ||
    normalized === ".." ||
    normalized.startsWith("..")
  );
}

function validatePath(path: Stringifiable): Result<string> {
  const strPath = String(path);

  const invalidChars = validateArgument(strPath);
  if (invalidChars.isError()) {
    return invalidChars;
  }

  if (checkSneakyPath(strPath)) {
    return ErrFromText("You've attempted to pass a sneaky path to pass. Go home.");
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
