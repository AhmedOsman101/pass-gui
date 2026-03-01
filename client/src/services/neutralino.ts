import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
  type OperatingSystem,
  os,
} from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result, wrapAsyncThrowable } from "lib-result";
import stripAnsi from "strip-ansi";
import { buildShellCommand, type OsType as ShellOsType } from "@/lib/shell";
import type { AllowedCommand, Stringifiable } from "@/types";
import { fs } from "./filesystem";

const ALLOWED_COMMANDS: AllowedCommand[] = [
  "pass",
  "gpg",
  "gpg2",
  "type",
  "ls",
  "where.exe",
  "which",
  "readlink",
  "file",
];

/**
 * Service providing NeutralinoJS platform abstraction.
 * Handles command execution, environment variables, binary resolution,
 * and cross-platform compatibility (Linux, macOS, Windows).
 */
class NeutralinoService {
  public OS: OperatingSystem = window.NL_OS;
  public HOME_DIR = "";

  private initialized = false;

  /**
   * Initializes the service by resolving the home directory.
   * Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    this.HOME_DIR = await this.getHomeDir();
    this.initialized = true;
  }

  /**
   * Returns the shell type for the current OS ("posix" or "windows").
   */
  private getShellOsType(): ShellOsType {
    return this.OS === "Windows" ? "windows" : "posix";
  }

  /**
   * Executes a shell command with properly quoted arguments.
   * ANSI escape codes are stripped from output.
   * Throws on non-zero exit codes (wrapped in Result).
   */
  async execCmd(
    command: string,
    args?: Stringifiable[],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult>> {
    const wrappedExec = wrapAsyncThrowable(
      async (
        cmd: string,
        cmdArgs?: Stringifiable[],
        cmdOptions?: ExecCommandOptions
      ) => {
        const shellType = this.getShellOsType();
        const fullCmd = buildShellCommand(cmd, cmdArgs ?? [], shellType);

        const result = await os.execCommand(fullCmd, cmdOptions);
        result.stdOut = stripAnsi(result.stdOut);
        result.stdErr = stripAnsi(result.stdErr);

        if (result.exitCode !== 0) {
          throw new Error(
            `Command failed with exit code ${result.exitCode}${result.stdErr.length ? `\n${result.stdErr}` : ""}`
          );
        }

        return result;
      }
    );

    return await wrappedExec(command, args, options);
  }

  /**
   * Executes an allowed command with argument validation.
   * Use this for known-safe commands like pass, gpg, etc.
   */
  async safeExec(
    command: AllowedCommand,
    args: Stringifiable[],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult>> {
    return await this.execCmd(command, args, options);
  }

  /**
   * Gets an environment variable value, returning a default if not set or empty.
   */
  async getEnv(key: string, defaultValue: Stringifiable = ""): Promise<string> {
    const value = await os.getEnv(key);
    return value === "" ? String(defaultValue) : value;
  }

  /**
   * Resolves the user's home directory based on the current OS.
   * Uses $HOME on Unix and $USERPROFILE on Windows.
   * Throws if the directory cannot be resolved (critical failure).
   */
  async getHomeDir(): Promise<string> {
    switch (this.OS) {
      case "Linux":
      case "Darwin":
      case "FreeBSD": {
        const home = await this.getEnv("HOME");
        if (!home) {
          throw new Error(
            "Unable to locate home directory. Please set the HOME environment variable."
          );
        }
        return home;
      }
      case "Windows": {
        const home = await this.getEnv("USERPROFILE");
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

  /**
   * Resolves the platform-specific configuration directory.
   * Uses os.getPath("config") from NeutralinoJS which handles:
   * - Linux: XDG_CONFIG_HOME or ~/.config
   * - macOS: ~/Library/Application Support
   * - Windows: %APPDATA%
   * @throws Error if the directory cannot be resolved
   */
  async getConfigDir(): Promise<string> {
    return await os.getPath("config");
  }

  /**
   * Checks if a command/program exists in the system PATH.
   * Uses `type` on Unix and `where.exe` on Windows.
   */
  async commandExists(program: string): Promise<Result<boolean>> {
    if (this.OS === "Windows") {
      const whereResult = await this.execCmd("where.exe", [program]);
      if (!whereResult.isError() && whereResult.ok.exitCode === 0) {
        return Ok(true);
      }
    } else {
      const typeResult = await this.execCmd("type", [program]);
      if (!typeResult.isError() && typeResult.ok.exitCode === 0) {
        return Ok(true);
      }
    }

    return Ok(false);
  }

  /**
   * Resolves the full path to a binary, following symlinks.
   * Also detects if the binary is a script (has shebang).
   */
  async resolveBinaryPath(program: string): Promise<Result<string>> {
    const existsResult = await this.commandExists(program);
    if (existsResult.isError() || !existsResult.ok) {
      return ErrFromText(`Binary not found: ${program}`);
    }

    switch (this.OS) {
      case "Linux":
      case "Darwin":
      case "FreeBSD": {
        const typeResult = await this.execCmd("type", ["-p", program]);
        let binPath: string;
        if (!typeResult.isError() && typeResult.ok.exitCode === 0) {
          binPath = typeResult.ok.stdOut.trim();
        } else {
          return ErrFromText(`Failed to resolve path for: ${program}`);
        }

        const lsResult = await this.execCmd("ls", ["-l", binPath]);
        let resolvedPath = binPath;
        let isSymlink = false;

        if (!lsResult.isError() && lsResult.ok.exitCode === 0) {
          const lsOutput = lsResult.ok.stdOut;
          isSymlink = lsOutput.startsWith("l");
          if (isSymlink) {
            const match = lsOutput.match(/->\s+(.+)$/m);
            if (match?.[1]) {
              let target = match[1].trim();
              if (!target.startsWith("/")) {
                const dir = binPath.substring(0, binPath.lastIndexOf("/"));
                target = `${dir}/${target}`;
              }
              resolvedPath = target;
              debug.log(
                `Binary '${program}' is a symlink. Real path: ${resolvedPath}`
              );
            }
          }
        }

        const shebangResult = await this.detectShebang(resolvedPath);
        if (!shebangResult.isError() && shebangResult.ok) {
          debug.log(
            `Binary '${program}' is a script (${shebangResult.ok}). Real path: ${resolvedPath}`
          );
        }

        return Ok(resolvedPath);
      }
      case "Windows": {
        const whereResult = await this.execCmd("where.exe", [program]);
        if (whereResult.isError()) {
          return ErrFromText(`Failed to resolve path for: ${program}`);
        }
        const binPath = whereResult.ok.stdOut.trim().split("\n")[0];
        if (!binPath) {
          return ErrFromText(`Could not resolve path for: ${program}`);
        }

        const isBatch =
          binPath.toLowerCase().endsWith(".bat") ||
          binPath.toLowerCase().endsWith(".cmd");
        const isShortcut = binPath.toLowerCase().endsWith(".lnk");

        if (isBatch || isShortcut) {
          debug.log(
            `Binary '${program}' is a ${isShortcut ? "shortcut" : "batch file"}. Path: ${binPath}`
          );
        }

        return Ok(binPath);
      }
      default:
        return ErrFromText("Unknown Operating System");
    }
  }

  /**
   * Detects if a file is a script by checking for shebang (#!) prefix.
   */
  private async detectShebang(path: string): Promise<Result<string | null>> {
    const readFileResult = await fs.readFile(path, { pos: 0, size: 2 });

    if (readFileResult.isError()) {
      return Ok(null);
    }

    const content = readFileResult.ok;
    if (
      content.length >= 2 &&
      content.charCodeAt(0) === 0x23 &&
      content.charCodeAt(1) === 0x21
    ) {
      return Ok("script");
    }
    return Ok(null);
  }
}

const neu = new NeutralinoService();
const neuInitialized = neu.init();

export { neu, neuInitialized, NeutralinoService, ALLOWED_COMMANDS };
