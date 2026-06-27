import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
  type OperatingSystem,
  os,
} from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result, wrapAsync } from "lib-result";
import stripAnsi from "strip-ansi";
import Path from "@/lib/path";
import {
  buildShellCommand,
  type OsType as ShellOsType,
  validateArgument,
  validateCommand,
} from "@/lib/shell";
import {
  ALLOWED_COMMANDS,
  type AllowedCommand,
  type Stringifiable,
} from "@/types";

type ExecCommandArgs = {
  cmd: string;
  args?: Stringifiable[];
  options?: ExecCommandOptions;
};

type SafeExecCommandArgs = {
  cmd: AllowedCommand;
  args?: Stringifiable[];
  options?: ExecCommandOptions;
};

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

    const homeDir = await Path.getHomeDir();
    if (homeDir.isError()) {
      throw homeDir.error;
    }

    this.HOME_DIR = homeDir.ok;
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
  async execCmd({
    cmd,
    args,
    options,
  }: ExecCommandArgs): Promise<Result<ExecCommandResult>> {
    const cmdValidation = validateCommand(cmd);
    if (cmdValidation.isError()) return Err(cmdValidation.error);

    for (const arg of args ?? []) {
      const argValidation = validateArgument(String(arg));
      if (argValidation.isError()) return Err(argValidation.error);
    }

    return await wrapAsync(async () => {
      const shellType = this.getShellOsType();
      const fullCmd = buildShellCommand(cmd, args ?? [], shellType);

      const result = await os.execCommand(fullCmd, options);
      result.stdOut = stripAnsi(result.stdOut);
      result.stdErr = stripAnsi(result.stdErr);

      if (result.exitCode !== 0) {
        throw new Error(
          `Command failed with exit code ${result.exitCode}${result.stdErr.length ? `\n${result.stdErr}` : ""}`
        );
      }

      return result;
    });
  }

  /**
   * Executes an allowed command with argument validation.
   * Use this for known-safe commands like pass, gpg, etc.
   */
  async safeExec({
    cmd,
    args,
    options,
  }: SafeExecCommandArgs): Promise<Result<ExecCommandResult>> {
    if (ALLOWED_COMMANDS.includes(cmd)) {
      return await this.execCmd({ cmd, args, options });
    }

    return ErrFromText(`Command ${cmd} is not allowed in safe execution mode`);
  }

  /**
   * Gets an environment variable value, returning a default if not set or empty.
   */
  async getEnv(key: string, defaultValue: Stringifiable = ""): Promise<string> {
    const value = await os.getEnv(key);
    return value === "" ? String(defaultValue) : value;
  }

  /**
   * Checks if a command/program exists in the system PATH.
   * Uses `which` on Unix and `where.exe` on Windows.
   */
  async commandExists(program: string): Promise<Result<boolean>> {
    if (this.OS === "Windows") {
      const whereResult = await this.execCmd({
        cmd: "where.exe",
        args: [program],
      });
      if (whereResult.isOk() && whereResult.ok.exitCode === 0) {
        return Ok(true);
      }
    } else {
      const whichResult = await this.execCmd({
        cmd: "which",
        args: [program],
      });
      if (whichResult.isOk() && whichResult.ok.exitCode === 0) {
        return Ok(true);
      }
    }

    return Ok(false);
  }

  /**
   * Resolves the full path to a binary, following symlinks.
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
        const whichResult = await this.execCmd({
          cmd: "which",
          args: [program],
        });
        if (whichResult.isError() || whichResult.ok.exitCode !== 0) {
          return ErrFromText(`Failed to resolve path for: ${program}`);
        }

        const binPath = whichResult.ok.stdOut.trim();
        if (!binPath) {
          return ErrFromText(`Could not resolve path for: ${program}`);
        }

        const readlinkResult = await this.execCmd({
          cmd: "readlink",
          args: ["-f", binPath],
        });

        if (readlinkResult.isOk() && readlinkResult.ok.exitCode === 0) {
          const resolvedPath = readlinkResult.ok.stdOut.trim();
          if (resolvedPath && resolvedPath !== binPath) {
            debug.log(
              `Binary '${program}' is a symlink. Real path: ${resolvedPath}`
            );
            return Ok(resolvedPath);
          }
        }

        return Ok(binPath);
      }
      case "Windows": {
        const whereResult = await this.execCmd({
          cmd: "where.exe",
          args: [program],
        });

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
}

const neu = new NeutralinoService();
const neuInitialized = neu.init();

export { NeutralinoService, neu, neuInitialized };
