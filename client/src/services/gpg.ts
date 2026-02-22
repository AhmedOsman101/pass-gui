import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
} from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result } from "lib-result";
import { compareVersions } from "@/lib/utils";
import type {
  AllowedCommand,
  GpgBinaryInfo,
  SecretKey,
  Stringifiable,
  Version,
} from "@/types";
import { neu } from "./neutralino";

class GpgService {
  public command: AllowedCommand | "" = "";
  public version: Version = { major: 0, minor: 0, patch: 0 };
  public homeDir = "";

  private getCommand(): AllowedCommand {
    return this.command || "gpg";
  }

  async init(): Promise<Result<boolean>> {
    const existsResult = await this.gpgExists();

    if (existsResult.isError()) return Err(existsResult.error);
    if (!existsResult.ok) return Ok(false);

    const homeDir = await neu.getEnv("GNUPGHOME");
    if (homeDir) this.homeDir = homeDir;

    return Ok(true);
  }

  async gpgExists(): Promise<Result<boolean>> {
    const gpg2Exists = await neu.commandExists("gpg2");
    if (!gpg2Exists.isError() && gpg2Exists.ok) {
      this.command = "gpg2";
      const versionResult = await this.parseVersion();
      if (!versionResult.isError()) return Ok(true);
    }

    const gpgExists = await neu.commandExists("gpg");
    if (!gpgExists.isError() && gpgExists.ok) {
      this.command = "gpg";
      const versionResult = await this.parseVersion();
      if (!versionResult.isError()) return Ok(true);
    }

    return Ok(false);
  }

  private async parseVersion(): Promise<Result<boolean>> {
    const cmdResult = await neu.safeExec(this.getCommand(), ["--version"]);
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) {
      return ErrFromText("Failed to get GPG version");
    }

    const output = cmdResult.ok.stdOut;
    const versionMatch = output.match(/gpg \(GnuPG\) (\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1] as string, 10);
      this.version.minor = Number.parseInt(versionMatch[2] as string, 10);
      this.version.patch = Number.parseInt(versionMatch[3] as string, 10);
    }

    if (!this.homeDir) {
      const homeMatch = output.match(/Home:\s*(.+)/m);
      if (homeMatch?.[1]) this.homeDir = homeMatch[1].trim();
    }

    debug.log(
      `GPG found: ${this.getCommand()} v${this.version.major}.${this.version.minor}.${this.version.patch}, Home: ${this.homeDir}`
    );

    return Ok(true);
  }

  checkVersion(version: Version): boolean {
    return compareVersions(version, { major: 0, minor: 0, patch: 0 }) >= 0;
  }

  async validateGpgBinary(): Promise<Result<GpgBinaryInfo>> {
    if (!this.getCommand()) return ErrFromText("GPG binary not resolved");

    const resolveResult = await neu.resolveBinaryPath(this.getCommand());
    if (resolveResult.isError()) {
      return ErrFromText(
        `Could not resolve GPG binary: ${resolveResult.error.message}`
      );
    }

    const resolvedPath = resolveResult.ok.trim();

    return Ok({
      path: resolvedPath,
      command: this.getCommand(),
    } as GpgBinaryInfo);
  }

  async listSecretKeys(): Promise<Result<SecretKey[]>> {
    if (!this.getCommand()) {
      return ErrFromText("GPG binary not resolved");
    }

    const cmdResult = await neu.safeExec(this.getCommand(), [
      "--list-secret-keys",
      "--with-colons",
      "--fixed-list-mode",
    ]);

    if (cmdResult.isError()) return Err(cmdResult.error);

    if (cmdResult.ok.exitCode !== 0) {
      return ErrFromText(`GPG list-secret-keys failed: ${cmdResult.ok.stdErr}`);
    }

    const keys = this.parseSecretKeys(cmdResult.ok.stdOut);
    return Ok(keys);
  }

  private parseSecretKeys(output: string): SecretKey[] {
    const keys: SecretKey[] = [];
    const lines = output.split("\n");

    let currentKey: Partial<SecretKey> | null = null;

    for (const line of lines) {
      const fields = line.split(":");

      if (fields[0] === "sec") {
        if (currentKey?.keyId) {
          keys.push(currentKey as SecretKey);
        }

        currentKey = {
          keyId: fields[4] || "",
          algorithm: fields[3] || "",
          creationDate: fields[5] ? this.parseTimestamp(fields[5]) : null,
          expirationDate: fields[6] ? this.parseTimestamp(fields[6]) : null,
          userId: "",
          userIds: [],
        };
      } else if (fields[0] === "uid" && currentKey) {
        const userId = fields[9] || "";
        if (userId) {
          currentKey.userIds?.push(userId);
          if (!currentKey.userId) {
            currentKey.userId = userId;
          }
        }
      } else if (fields[0] === "fpr" && currentKey && fields[9]) {
        currentKey.fingerprint = fields[9];
      }
    }

    if (currentKey?.keyId) {
      keys.push(currentKey as SecretKey);
    }

    return keys;
  }

  private parseTimestamp(timestamp: string): string | null {
    const ts = Number.parseInt(timestamp, 10);
    if (Number.isNaN(ts) || ts === 0) return null;

    return new Date(ts * 1000).toISOString().split("T")[0] ?? null;
  }

  async exec(
    args: Stringifiable[] = [],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult>> {
    if (!this.getCommand()) return ErrFromText("GPG binary not resolved");

    const envParts: string[] = [];
    if (this.homeDir) {
      envParts.push(`GNUPGHOME="${this.homeDir}"`);
    }

    const fullCommand =
      envParts.length > 0
        ? `${envParts.join(" ")} ${this.getCommand()}`
        : this.getCommand();

    return await neu.execCmd(fullCommand, args, options);
  }
}

const gpg = new GpgService();
const gpgInitialized = gpg.init();

export { gpg, gpgInitialized, GpgService };
