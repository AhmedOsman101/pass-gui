import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
  type OperatingSystem,
  os,
} from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result, wrapAsyncThrowable } from "lib-result";
import stripAnsi from "strip-ansi";
import Path from "@/lib/path";
import { buildShellCommand, type OsType as ShellOsType } from "@/lib/shell";
import type { AllowedCommand, Stringifiable } from "@/types";

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
] as const;

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

    this.HOME_DIR = await Path.getHomeDir();
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
    const wrappedExec = wrapAsyncThrowable(
      async ({
        cmd: command,
        args: cmdArgs,
        options: cmdOptions,
      }: ExecCommandArgs) => {
        const shellType = this.getShellOsType();
        const fullCmd = buildShellCommand(command, cmdArgs ?? [], shellType);

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

    return await wrappedExec({ cmd, args, options });
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
      const whereResult = await this.execCmd({
        cmd: "where.exe",
        args: [program],
      });
      if (!whereResult.isError() && whereResult.ok.exitCode === 0) {
        return Ok(true);
      }
    } else {
      const typeResult = await this.execCmd({
        cmd: "type",
        args: [program],
      });
      if (typeResult.isOk() && typeResult.ok.exitCode === 0) {
        return Ok(true);
      }

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
        const typeResult = await this.execCmd({
          cmd: "type",
          args: ["-p", program],
        });
        let binPath: string;
        if (typeResult.isOk() && typeResult.ok.exitCode === 0) {
          binPath = typeResult.ok.stdOut.trim();
        } else {
          const whichResult = await this.execCmd({
            cmd: "which",
            args: [program],
          });
          if (whichResult.isOk() && whichResult.ok.exitCode === 0) {
            binPath = whichResult.ok.stdOut.trim();
          } else {
            return ErrFromText(`Failed to resolve path for: ${program}`);
          }
        }

        const lsResult = await this.execCmd({
          cmd: "ls",
          args: ["-l", binPath],
        });
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

        return Ok(resolvedPath);
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

export { neu, neuInitialized, NeutralinoService, ALLOWED_COMMANDS };
