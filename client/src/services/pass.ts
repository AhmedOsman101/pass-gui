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

class PassService {
  public storeDirectory = "";
  public isInitialized = false;
  public version: Version = { major: 0, minor: 0, patch: 0 };

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

  private async checkInitialized(storePath: string): Promise<Result<boolean>> {
    const gpgIdPath = `${storePath}/.gpg-id`;
    return await fs.exists(gpgIdPath);
  }

  checkVersion(version: Version): boolean {
    return compareVersions(version, PASS_MIN_VERSION) >= 0;
  }

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

  async passExists(): Promise<Result<boolean>> {
    const existsResult = await neu.commandExists("pass");
    if (existsResult.isError() || !existsResult.ok) return Ok(false);

    const validateResult = await this.validatePassBinary();
    if (validateResult.isError()) {
      debug.log(`Warning: ${validateResult.error.message}`);
    }

    const cmdResult = await neu.safeExec("pass", ["--version"]);
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) return Ok(false);

    const versionMatch = cmdResult.ok.stdOut.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1] as string, 10);
      this.version.minor = Number.parseInt(versionMatch[2] as string, 10);
      this.version.patch = Number.parseInt(versionMatch[3] as string, 10);
    }

    return Ok(this.checkVersion(this.version));
  }

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

    return await neu.execCmd(
      `PASSWORD_STORE_DIR="${this.storeDirectory}" pass`,
      validatedArgs,
      options
    );
  }
}

const pass = new PassService();
const passInitialized = pass.init();

export { pass, passInitialized, PassService };
