import type { ExecCommandOptions, ExecCommandResult } from "@neutralinojs/lib";
import { Err, Ok, type Result } from "lib-result";
import { PASS_MIN_VERSION } from "@/lib/constants";
import { type CommandFailedError, VersionCheckError } from "@/lib/errors";
import { validatePath } from "@/lib/shell";
import { compareVersions } from "@/lib/utils";
import type { Stringifiable, Version } from "@/types";
import type { VersionCheck } from "@/types/readiness";
import { Config } from "./config";
import { Fs } from "./filesystem";
import { Gpg } from "./gpg";
import { Neu } from "./neutralino";

/**
 * Error thrown by `PassService.checkVersion()`. Same payload as the shared
 * `VersionCheckError` but a distinct type so call sites can match on the
 * pass operation family specifically.
 */
class PassVersionCheckError extends VersionCheckError {}

/**
 * Error thrown by `PassService.exec()` when pre-execution validation
 * rejects the store directory or one of the arguments. Carries the
 * rejected value and the underlying cause.
 */
class PassExecError extends Error {
  public argument: string;
  public cause: Error | null;

  constructor(argument: string, message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.argument = argument;
    this.cause = cause ?? null;
  }
}

/**
 * Service for interacting with the `pass` password manager.
 * Handles binary detection, version validation, and command execution
 * with proper environment scoping for the password store.
 */
class PassService {
  public storePath = "";
  public isInitialized = false;
  public version: Version = { major: 0, minor: 0, patch: 0 };

  /**
   * Overrides the password store directory at runtime.
   * The value is used by `exec()` to set `PASSWORD_STORE_DIR` for all
   * subsequent calls.
   */
  setStorePath(path: string): void {
    this.storePath = path;
  }

  /**
   * Initializes the pass service by reading `PASSWORD_STORE_DIR` as a
   * fallback and checking if the store has a `.gpg-id` file. Config
   * should override this via `setStorePath()` when available.
   */
  async init(): Promise<Result<boolean>> {
    const envStoreDir = await Neu.getEnv("PASSWORD_STORE_DIR");
    this.storePath =
      envStoreDir || (await Fs.join(Neu.HOME_DIR, ".password-store"));

    const result = await this.checkInitialized(this.storePath);
    if (result.isError()) {
      this.isInitialized = false;
      return Ok(false);
    }

    this.isInitialized = result.ok;

    return Ok(true);
  }

  /**
   * Checks if a password store is properly initialized by looking for .gpg-id.
   */
  private async checkInitialized(storePath: string): Promise<Result<boolean>> {
    const gpgIdPath = await Fs.join(storePath, ".gpg-id");
    return await Fs.exists(gpgIdPath);
  }

  /**
   * Checks if pass version meets the minimum supported version requirement.
   */
  async checkVersion(): Promise<Result<VersionCheck, PassVersionCheckError>> {
    const cmdResult = await Neu.exec({ cmd: "pass", args: ["--version"] });
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) {
      return Err(
        new PassVersionCheckError(
          false,
          this.version,
          PASS_MIN_VERSION,
          cmdResult.ok?.stdErr,
          cmdResult.error
        )
      );
    }
    const versionMatch = cmdResult.ok.stdOut.match(/v(\d+)\.(\d+)\.(\d+)/) as
      | string[]
      | null;
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1], 10);
      this.version.minor = Number.parseInt(versionMatch[2], 10);
      this.version.patch = Number.parseInt(versionMatch[3], 10);
    }

    return Ok({
      valid: compareVersions(this.version, PASS_MIN_VERSION) >= 0,
      found: this.version,
      expected: PASS_MIN_VERSION,
    });
  }

  /**
   * Checks if pass is available on the system.
   * On Windows, falls back to checking pass.cmd and pass.ps1 explicitly
   * in case PATHEXT does not resolve them via the bare "pass" name.
   */
  async passExists(): Promise<Result<boolean>> {
    const existsResult = await Neu.commandExists("pass");
    if (existsResult.isOk() && existsResult.ok) {
      return Ok(true);
    }

    if (Neu.OS === "Windows") {
      for (const name of ["pass.cmd", "pass.ps1"]) {
        const fallback = await Neu.commandExists(name);
        if (fallback.isOk() && fallback.ok) {
          return Ok(true);
        }
      }
    }

    return Ok(false);
  }

  /**
   * Executes a pass command with `PASSWORD_STORE_DIR` and `GNUPGHOME`
   * environment variables set. Caller-provided envs merge on top of
   * the defaults. All arguments are validated against path traversal.
   *
   * **Scoped-call pattern** (preferred for one-off operations):
   * Pass `cwd` and override `PASSWORD_STORE_DIR` via `options.envs`
   * to scope a single call without mutating `this.storePath`. Use this
   * from recipes (e.g. `Store.create`) that operate on a temporary
   * store path different from the active one.
   *
   * ```ts
   * // One-off init against a new store path — does NOT mutate Pass.storePath
   * await Pass.exec(["init", gpgKeyId], {
   *   cwd: newPath,
   *   envs: { PASSWORD_STORE_DIR: newPath },
   * });
   * ```
   *
   * `Pass.setStorePath` should be reserved for the active-store
   * switcher and app startup only. Recipes and components must use
   * the scoped-call pattern above.
   */
  async exec(
    args: Stringifiable[] = [],
    options?: ExecCommandOptions
  ): Promise<
    Result<ExecCommandResult, PassExecError | CommandFailedError | Error>
  > {
    const storeDirValidation = await validatePath(this.storePath);
    if (storeDirValidation.isError()) {
      return Err(
        new PassExecError(
          this.storePath,
          `Invalid store directory: ${storeDirValidation.error.message}`,
          storeDirValidation.error
        )
      );
    }

    const validatedArgs: Stringifiable[] = [];
    for (const arg of args) {
      const argValidation = await validatePath(arg);
      if (argValidation.isError()) {
        return Err(
          new PassExecError(
            String(arg),
            `Invalid argument: ${argValidation.error.message}`,
            argValidation.error
          )
        );
      }
      validatedArgs.push(argValidation.ok);
    }

    const defaultEnvs: Record<string, string> = {
      PASSWORD_STORE_DIR: this.storePath,
    };
    if (Gpg.homeDir) defaultEnvs.GNUPGHOME = Gpg.homeDir;

    // Wire gpg.opts from config into PASSWORD_STORE_GPG_OPTS
    const configResult = await Config.load();
    if (configResult.isOk()) {
      const gpgOpts = configResult.ok.data.gpg?.opts;
      if (gpgOpts && Array.isArray(gpgOpts) && gpgOpts.length > 0) {
        defaultEnvs.PASSWORD_STORE_GPG_OPTS = (gpgOpts as string[]).join(" ");
      }
    }

    return await Neu.exec({
      cmd: "pass",
      args: validatedArgs,
      options: {
        ...options,
        envs: { ...defaultEnvs, ...options?.envs },
      },
    });
  }
}

const Pass = new PassService();
const passInitialized = Pass.init();

export {
  Pass,
  PassExecError,
  PassService,
  PassVersionCheckError,
  passInitialized,
};
