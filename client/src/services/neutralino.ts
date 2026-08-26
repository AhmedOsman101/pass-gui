import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
  events,
  type OperatingSystem,
  os,
} from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result, wrapAsync } from "lib-result";
import stripAnsi from "strip-ansi";
import { CommandFailedError } from "@/lib/errors";
import { Logger } from "@/lib/logger";
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

const SECRET_MASK = "[passphrase hidden]";

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

type SpawnArgs = {
  cmd: string;
  args?: Stringifiable[];
  /** Secret stdin — never appears in display command or logs. */
  stdin?: string;
  options?: ExecCommandOptions;
  onStdOut?: (data: string) => void;
  onStdErr?: (data: string) => void;
};

/**
 * Service providing NeutralinoJS platform abstraction.
 * Handles command execution, environment variables, binary resolution,
 * and cross-platform compatibility (Linux, macOS, Windows).
 */
class NeutralinoService {
  public OS: OperatingSystem = window.NL_OS;
  public HOME_DIR = "";
  /** Last init failure — distinct from readiness issues; app is paralyzed without HOME_DIR. */
  public initError: Error | null = null;

  private initialized = false;

  private initPromise: Promise<Result<void, Error>> | null = null;

  /**
   * Initializes the service by resolving the home directory.
   * Failable — returns Err instead of throwing. On HOME_DIR failure the
   * app cannot function (all checks require it) so callers must surface
   * a distinct critical error, not a generic readiness issue.
   * Safe to call multiple times.
   */
  async init(): Promise<Result<void, Error>> {
    if (this.initialized) return Ok(undefined);

    const homeDir = await Path.getHomeDir();
    if (homeDir.isError()) {
      await Logger.error(`Neu.init(): ${homeDir.error.message}`);
      this.initError = homeDir.error;
      return Err(homeDir.error);
    }

    this.HOME_DIR = homeDir.ok;
    this.initialized = true;
    this.initError = null;
    return Ok(undefined);
  }

  /**
   * Eager, deduped, failable init. Required before the gate — if it fails
   * the gate shows a distinct critical screen (not a swallowed NEED_PASS).
   * Concurrent callers share the same in-flight promise; after failure
   * the next call retries.
   */
  async ensureInitialized(): Promise<Result<void, Error>> {
    if (this.initialized) return Ok(undefined);
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.init();
    const result = await this.initPromise;
    this.initPromise = null;
    return result;
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
  async exec({
    cmd,
    args,
    options,
  }: ExecCommandArgs): Promise<
    Result<ExecCommandResult, CommandFailedError | Error>
  > {
    const cmdValidation = validateCommand(cmd);
    if (cmdValidation.isError()) return Err(cmdValidation.error);

    for (const arg of args ?? []) {
      const argValidation = validateArgument(String(arg));
      if (argValidation.isError()) return Err(argValidation.error);
    }

    const execResult = await wrapAsync(async () => {
      const shellType = this.getShellOsType();
      const fullCmd = buildShellCommand(cmd, args ?? [], shellType);

      const result = await os.execCommand(fullCmd, options);
      result.stdOut = stripAnsi(result.stdOut);
      result.stdErr = stripAnsi(result.stdErr);

      if (result.exitCode !== 0) {
        // ...result contains exitCode, stdOut, stdErr, and pid
        throw new CommandFailedError({ cmd, args, ...result });
      }

      return result;
    });

    if (execResult.isError()) {
      const error = execResult.error;
      await Logger.error(
        `exec("${cmd}") failed:`,
        error instanceof CommandFailedError
          ? `exit code ${error.exitCode}, stderr: ${error.stdErr}`
          : error
      );
    }

    return execResult;
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
      return await this.exec({ cmd, args, options });
    }

    return ErrFromText(`Command ${cmd} is not allowed in safe execution mode`);
  }

  /**
   * Builds a display command for the stream box. Secrets are masked:
   * - args at `maskIndices` are replaced with `[passphrase hidden]`
   * - stdin secret is never included; caller can append the mask manually
   * Shell-quoting mirrors `buildShellCommand`.
   */
  buildDisplayCommand(
    cmd: string,
    args: Stringifiable[] = [],
    opts?: { maskIndices?: number[]; hideStdin?: boolean }
  ): string {
    const shellType = this.getShellOsType();
    const masked = args.map((a, i) =>
      opts?.maskIndices?.includes(i) ? SECRET_MASK : String(a)
    );
    // ponytail: reuse existing shell quoting — no new dep
    return buildShellCommand(cmd, masked, shellType);
  }

  /**
   * Streaming execution via `os.spawnProcess` with live stdOut/stdErr.
   * Use for long-running operations (e.g. gpg --gen-key). Quick commands
   * should use `exec` to avoid streaming overhead.
   *
   * Secrets via `stdin` never appear in the display command — caller must
   * build the display string with `buildDisplayCommand` and not include
   * the secret.
   */
  async spawn({
    cmd,
    args,
    stdin,
    options,
    onStdOut,
    onStdErr,
  }: SpawnArgs): Promise<
    Result<ExecCommandResult, CommandFailedError | Error>
  > {
    const cmdValidation = validateCommand(cmd);
    if (cmdValidation.isError()) return Err(cmdValidation.error);
    for (const arg of args ?? []) {
      const argValidation = validateArgument(String(arg));
      if (argValidation.isError()) return Err(argValidation.error);
    }

    const shellType = this.getShellOsType();
    const fullCmd = buildShellCommand(cmd, args ?? [], shellType);

    const spawnResult = await wrapAsync(
      async () =>
        await os.spawnProcess(fullCmd, {
          cwd: options?.cwd,
          envs: options?.envs,
        })
    );
    if (spawnResult.isError()) {
      await Logger.error(
        `spawn("${cmd}") failed to spawn: ${spawnResult.error.message}`
      );
      return Err(spawnResult.error);
    }
    const proc = spawnResult.ok;

    let stdOut = "";
    let stdErr = "";
    let exitCode: number | null = null;

    let resolveExit: (code: number) => void;
    const exitPromise = new Promise<number>(resolve => {
      resolveExit = resolve;
    });

    const handler = (ev: Event): void => {
      const detail = (ev as CustomEvent).detail as {
        id: number;
        action: string;
        data: unknown;
      };
      if (detail.id !== proc.id) return;
      if (detail.action === "stdOut") {
        const chunk = String(detail.data);
        stdOut += chunk;
        onStdOut?.(chunk);
      } else if (detail.action === "stdErr") {
        const chunk = String(detail.data);
        stdErr += chunk;
        onStdErr?.(chunk);
      } else if (detail.action === "exit") {
        exitCode = Number(detail.data);
        resolveExit(exitCode);
      }
    };

    const onResult = await wrapAsync(
      async () =>
        await events.on("spawnedProcess", handler as (ev: CustomEvent) => void)
    );
    if (onResult.isError()) {
      await Logger.error(
        `spawn("${cmd}") failed to attach listener: ${onResult.error.message}`
      );
      return Err(onResult.error);
    }

    // Send stdin if provided, then always close it so the child does not hang
    if (stdin !== undefined) {
      const stdinResult = await wrapAsync(
        async () => await os.updateSpawnedProcess(proc.id, "stdIn", stdin)
      );
      if (stdinResult.isError()) {
        await events.off(
          "spawnedProcess",
          handler as (ev: CustomEvent) => void
        );
        await Logger.error(
          `spawn("${cmd}") stdIn failed: ${stdinResult.error.message}`
        );
        return Err(stdinResult.error);
      }
    }
    // Close stdin — required for spawnProcess (always open) to let the process proceed
    await wrapAsync(
      async () => await os.updateSpawnedProcess(proc.id, "stdInEnd")
    );

    exitCode = await exitPromise;

    await wrapAsync(
      async () =>
        await events.off("spawnedProcess", handler as (ev: CustomEvent) => void)
    );

    stdOut = stripAnsi(stdOut);
    stdErr = stripAnsi(stdErr);

    const result: ExecCommandResult = {
      pid: proc.pid,
      stdOut,
      stdErr,
      exitCode: exitCode ?? -1,
    };

    if (result.exitCode !== 0) {
      const err = new CommandFailedError({ cmd, args, ...result });
      await Logger.error(
        `spawn("${cmd}") failed: exit code ${err.exitCode}, stderr: ${err.stdErr}`
      );
      return Err(err);
    }

    return Ok(result);
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
      const whereResult = await this.exec({
        cmd: "where.exe",
        args: [program],
      });
      if (whereResult.isOk()) return Ok(true);
    } else {
      const whichResult = await this.exec({
        cmd: "which",
        args: [program],
      });
      if (whichResult.isOk()) return Ok(true);
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
        const whichResult = await this.exec({
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

        const readlinkResult = await this.exec({
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
        const whereResult = await this.exec({
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

const Neu = new NeutralinoService();
// Eager but now failable and deduped via ensureInitialized — mount no longer
// blocks on it. Prefer `Neu.ensureInitialized()` for gate-driven lazy init.
const neuInitialized: Promise<Result<void, Error>> = Neu.ensureInitialized();

export { Neu, NeutralinoService, neuInitialized, SECRET_MASK };
