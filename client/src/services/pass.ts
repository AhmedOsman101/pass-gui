import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
} from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result } from "lib-result";
import { PASS_MIN_VERSION, SYSTEM_PASS_PATHS } from "@/lib/constants";
import { validatePath } from "@/lib/shell";
import { compareVersions } from "@/lib/utils";
import type { PassBinaryInfo, Stringifiable, Version } from "@/types";
import { fs } from "./filesystem";
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
   * Initializes the pass service by resolving the store directory
   * and checking if it's properly initialized with a .gpg-id file.
   */
  async init(): Promise<Result<boolean>> {
    this.storeDirectory = await neu.getEnv(
      "PASSWORD_STORE_DIR",
      `${neu.HOME_DIR}/.password-store`
    );

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
    const gpgIdPath = `${storePath}/.gpg-id`;
    return await fs.exists(gpgIdPath);
  }

  /**
   * Checks if pass version meets the minimum supported version requirement.
   */
  checkVersion(version: Version): boolean {
    return compareVersions(version, PASS_MIN_VERSION) >= 0;
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
   * Checks if pass is available on the system and meets version requirements.
   * Parses version from `pass --version` output.
   */
  async passExists(): Promise<Result<boolean>> {
    const existsResult = await neu.commandExists("pass");
    if (existsResult.isError() || !existsResult.ok) return Ok(false);

    const validateResult = await this.validatePassBinary();
    if (validateResult.isError()) {
      debug.log(`Warning: ${validateResult.error.message}`);
    }

    const cmdResult = await neu.safeExec({ cmd: "pass", args: ["--version"] });
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) return Ok(false);

    const versionMatch = cmdResult.ok.stdOut.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1] as string, 10);
      this.version.minor = Number.parseInt(versionMatch[2] as string, 10);
      this.version.patch = Number.parseInt(versionMatch[3] as string, 10);
    }

    return Ok(this.checkVersion(this.version));
  }

  /**
   * Executes a pass command with PASSWORD_STORE_DIR environment variable set.
   * All arguments are validated against path traversal attacks before execution.
   */
  async exec(
    args: Stringifiable[] = [],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult>> {
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

    return await neu.execCmd({
      cmd: "pass",
      args: validatedArgs,
      options: {
        ...options,
        envs: { PASSWORD_STORE_DIR: this.storeDirectory },
      },
    });
  }

  /**
   * Executes a pass command with custom environment variables.
   * Used when running pass against a custom store path or GNUPGHOME.
   */
  async execScoped(
    args: Stringifiable[] = [],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult>> {
    const validatedArgs: Stringifiable[] = [];
    for (const arg of args) {
      const argValidation = await validatePath(arg);
      if (argValidation.isError()) {
        return ErrFromText(`Invalid argument: ${argValidation.error.message}`);
      }
      validatedArgs.push(argValidation.ok);
    }

    return await neu.execCmd({
      cmd: "pass",
      args: validatedArgs,
      options,
    });
  }
}

const pass = new PassService();
const passInitialized = pass.init();

export { PassService, pass, passInitialized };
