import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
} from "@neutralinojs/lib";
import { ErrFromObject, ErrFromText, Ok, type Result } from "lib-result";
import { PASS_MIN_VERSION, SYSTEM_PASS_PATHS } from "@/lib/constants";
import type { CommandFailedError } from "@/lib/errors";
import { validatePath } from "@/lib/shell";
import { compareVersions } from "@/lib/utils";
import type { PassBinaryInfo, Stringifiable, Version } from "@/types";
import type { VersionCheck } from "@/types/readiness";
import { fs } from "./filesystem";
import { gpg } from "./gpg";
import { neu } from "./neutralino";

/**
 * Service for interacting with the `pass` password manager.
 * Handles binary detection, version validation, and command execution
 * with proper environment scoping for the password store.
 */
class PassService {
  public storeDirectory = "";
  public isInitialized = false;
  public version: Version = { major: 0, minor: 0, patch: 0 };

  /**
   * Overrides the password store directory at runtime.
   * The value is used by `exec()` to set `PASSWORD_STORE_DIR` for all
   * subsequent calls.
   */
  setStorePath(path: string): void {
    this.storeDirectory = path;
  }

  /**
   * Initializes the pass service by reading `PASSWORD_STORE_DIR` as a
   * fallback and checking if the store has a `.gpg-id` file. Config
   * should override this via `setStorePath()` when available.
   */
  async init(): Promise<Result<boolean>> {
    const envStoreDir = await neu.getEnv("PASSWORD_STORE_DIR");
    this.storeDirectory =
      envStoreDir || (await fs.join(neu.HOME_DIR, ".password-store"));

    const result = await this.checkInitialized(this.storeDirectory);
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
    const gpgIdPath = await fs.join(storePath, ".gpg-id");
    return await fs.exists(gpgIdPath);
  }

  /**
   * Checks if pass version meets the minimum supported version requirement.
   */
  async checkVersion(): Promise<Result<VersionCheck>> {
    const cmdResult = await neu.safeExec({ cmd: "pass", args: ["--version"] });
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) {
      return ErrFromObject({
        error: cmdResult.error || new Error(cmdResult.ok.stdErr),
        valid: false,
        found: this.version,
        expected: PASS_MIN_VERSION,
      });
    }
    const versionMatch = cmdResult.ok.stdOut.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1] as string, 10);
      this.version.minor = Number.parseInt(versionMatch[2] as string, 10);
      this.version.patch = Number.parseInt(versionMatch[3] as string, 10);
    }

    return Ok({
      valid: compareVersions(this.version, PASS_MIN_VERSION) >= 0,
      found: this.version,
      expected: PASS_MIN_VERSION,
    });
  }

  /**
   * Validates the pass binary by resolving its path and checking
   * if it's a system binary or a custom wrapper/script.
   */
  async validatePassBinary(): Promise<Result<PassBinaryInfo>> {
    const resolveResult = await neu.resolveBinaryPath("pass");
    if (resolveResult.isError()) {
      return ErrFromText(
        `Could not resolve pass binary: ${resolveResult.error.message}`
      );
    }

    const resolvedPath = resolveResult.ok.trim();
    const isSystemBinary = SYSTEM_PASS_PATHS.some(p =>
      resolvedPath.startsWith(p)
    );

    if (!isSystemBinary) {
      debug.log(`Pass is a custom script/wrapper. Path: ${resolvedPath}`);
    }

    return Ok({ path: resolvedPath, isSystemBinary });
  }

  /**
   * Checks if pass is available on the system.
   * On Windows, falls back to checking pass.cmd and pass.ps1 explicitly
   * in case PATHEXT does not resolve them via the bare "pass" name.
   */
  async passExists(): Promise<Result<boolean>> {
    const existsResult = await neu.commandExists("pass");
    if (existsResult.isOk() && existsResult.ok) {
      const validateResult = await this.validatePassBinary();
      if (validateResult.isError()) {
        debug.log(`Warning: ${validateResult.error.message}`);
      }
      return Ok(true);
    }

    if (neu.OS === "Windows") {
      for (const name of ["pass.cmd", "pass.ps1"]) {
        const fallback = await neu.commandExists(name);
        if (fallback.isOk() && fallback.ok) {
          debug.log(`Pass found as ${name}`);
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
   */
  async exec(
    args: Stringifiable[] = [],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult, CommandFailedError | Error>> {
    const storeDirValidation = await validatePath(this.storeDirectory);
    if (storeDirValidation.isError()) {
      return ErrFromText(
        `Invalid store directory: ${storeDirValidation.error.message}`
      );
    }

    const validatedArgs: Stringifiable[] = [];
    for (const arg of args) {
      const argValidation = await validatePath(arg);
      if (argValidation.isError()) {
        return ErrFromText(`Invalid argument: ${argValidation.error.message}`);
      }
      validatedArgs.push(argValidation.ok);
    }

    const defaultEnvs: Record<string, string> = {
      PASSWORD_STORE_DIR: this.storeDirectory,
    };
    if (gpg.homeDir) defaultEnvs.GNUPGHOME = gpg.homeDir;

    return await neu.exec({
      cmd: "pass",
      args: validatedArgs,
      options: {
        ...options,
        envs: { ...defaultEnvs, ...options?.envs },
      },
    });
  }
}

const pass = new PassService();
const passInitialized = pass.init();

export { PassService, pass, passInitialized };
