import {
  debug,
  type ExecCommandOptions,
  type ExecCommandResult,
} from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result } from "lib-result";
import { GPG_MIN_VERSION } from "@/lib/constants";
import { type CommandFailedError, VersionCheckError } from "@/lib/errors";
import { compareVersions } from "@/lib/utils";
import type {
  AllowedCommand,
  GpgBinaryInfo,
  SecretKey,
  Stringifiable,
  Version,
} from "@/types";
import type { VersionCheck } from "@/types/readiness";
import { Neu } from "./neutralino";

/**
 * Service for interacting with GPG (GNU Privacy Guard) for cryptographic operations.
 * Handles binary detection, version checking, secret key listing, and command execution.
 * Binary detection (`gpgExists`) and version validation (`checkVersion`) are separate
 * concerns — detection just resolves which binary is available, while version checking
 * parses the output of `gpg --version` and validates against the minimum.
 */
class GpgService {
  public command: AllowedCommand | "" = "";
  public version: Version = { major: 0, minor: 0, patch: 0 };
  public homeDir = "";

  /**
   * Returns the resolved GPG command, defaulting to "gpg" if not yet resolved.
   */
  private getCommand(): AllowedCommand {
    return this.command || "gpg";
  }

  /**
   * Overrides the GPG home directory at runtime.
   * The value is used by `exec()` to set `GNUPGHOME` for all subsequent calls.
   */
  setHome(home: string): void {
    this.homeDir = home;
  }

  /**
   * Initializes the GPG service by detecting the GPG binary and reading
   * the GNUPGHOME environment variable as a fallback. Does not parse
   * version info — call `checkVersion()` separately for version validation.
   */
  async init(): Promise<Result<boolean>> {
    const existsResult = await this.gpgExists();

    if (existsResult.isError()) return Err(existsResult.error);
    if (!existsResult.ok) return Ok(false);

    const homeDir = await Neu.getEnv("GNUPGHOME");
    if (homeDir) this.homeDir = homeDir;

    return Ok(true);
  }

  /**
   * Checks if GPG is available on the system.
   * Tries `gpg2` first (for compatibility), then falls back to `gpg`.
   * Only resolves the binary name — does not parse version or home directory.
   * On Windows, falls back to explicit .exe checks in case PATHEXT
   * does not resolve them via the bare names.
   */
  async gpgExists(): Promise<Result<boolean>> {
    const gpg2Exists = await Neu.commandExists("gpg2");
    if (!gpg2Exists.isError() && gpg2Exists.ok) {
      this.command = "gpg2";
      return Ok(true);
    }

    const gpgExists = await Neu.commandExists("gpg");
    if (!gpgExists.isError() && gpgExists.ok) {
      this.command = "gpg";
      return Ok(true);
    }

    if (Neu.OS === "Windows") {
      for (const name of ["gpg2.exe", "gpg.exe"]) {
        const fallback = await Neu.commandExists(name);
        if (!fallback.isError() && fallback.ok) {
          this.command = name.replace(".exe", "") as AllowedCommand;
          debug.log(`GPG found as ${name}`);
          return Ok(true);
        }
      }
    }

    return Ok(false);
  }

  /**
   * Runs `gpg --version` and parses the output to extract version info
   * and home directory. If `homeDir` was not already set (e.g. via `GNUPGHOME`
   * env var in `init()`), falls back to parsing the `Home:` line from output.
   * Returns a `VersionCheck` indicating whether the version meets `GPG_MIN_VERSION`.
   */
  async checkVersion(): Promise<Result<VersionCheck>> {
    const cmdResult = await Neu.safeExec({
      cmd: this.getCommand(),
      args: ["--version"],
    });
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) {
      return Err(
        new VersionCheckError(
          false,
          this.version,
          GPG_MIN_VERSION,
          cmdResult.ok?.stdErr,
          cmdResult.error
        )
      );
    }

    const output = cmdResult.ok.stdOut;
    const versionMatch = output.match(/gpg \(GnuPG\) (\d+)\.(\d+)\.(\d+)/) as
      | string[]
      | null;
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1], 10);
      this.version.minor = Number.parseInt(versionMatch[2], 10);
      this.version.patch = Number.parseInt(versionMatch[3], 10);
    }

    if (!this.homeDir) {
      const homeMatch = output.match(/Home:\s*(.+)/m);
      if (homeMatch?.[1]) this.homeDir = homeMatch[1].trim();
    }

    debug.log(
      `GPG found: ${this.getCommand()} v${this.version.major}.${this.version.minor}.${this.version.patch}, Home: ${this.homeDir}`
    );

    return Ok({
      valid: compareVersions(this.version, GPG_MIN_VERSION) >= 0,
      found: this.version,
      expected: GPG_MIN_VERSION,
    });
  }

  /**
   * Validates the GPG binary by resolving its full path.
   * Returns binary info including path and command name.
   */
  async validateGpgBinary(): Promise<Result<GpgBinaryInfo>> {
    if (!this.getCommand()) return ErrFromText("GPG binary not resolved");

    const resolveResult = await Neu.resolveBinaryPath(this.getCommand());
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

  /**
   * Lists all secret keys available in the GPG keyring.
   * Uses --with-colons and --fixed-list-mode for machine-readable output.
   */
  async listSecretKeys(): Promise<Result<SecretKey[]>> {
    if (!this.getCommand()) {
      return ErrFromText("GPG binary not resolved");
    }

    const cmdResult = await Neu.safeExec({
      cmd: this.getCommand(),
      args: ["--list-secret-keys", "--with-colons", "--fixed-list-mode"],
    });

    if (cmdResult.isError()) return Err(cmdResult.error);

    if (cmdResult.ok.exitCode !== 0) {
      return ErrFromText(`GPG list-secret-keys failed: ${cmdResult.ok.stdErr}`);
    }

    const keys = this.parseSecretKeys(cmdResult.ok.stdOut);
    return Ok(keys);
  }

  /**
   * Lists secret keys from a specified GNUPGHOME directory.
   * Used when verifying recipients for a store with a custom GNUPGHOME.
   */
  async listSecretKeysWithHome(
    gnupgHome: string
  ): Promise<Result<SecretKey[]>> {
    const cmdResult = await Neu.exec({
      cmd: this.getCommand(),
      args: ["--list-secret-keys", "--with-colons", "--fixed-list-mode"],
      options: { envs: { GNUPGHOME: gnupgHome } },
    });

    if (cmdResult.isError()) return Err(cmdResult.error);

    if (cmdResult.ok.exitCode !== 0) {
      return ErrFromText(`GPG list-secret-keys failed: ${cmdResult.ok.stdErr}`);
    }

    const keys = this.parseSecretKeys(cmdResult.ok.stdOut);
    return Ok(keys);
  }

  /**
   * Parses the colon-delimited output from `gpg --list-secret-keys`.
   * Extracts key ID, fingerprint, user IDs, algorithm, and dates.
   */
  private parseSecretKeys(output: string): SecretKey[] {
    const keys: SecretKey[] = [];
    const lines = output.split("\n");

    let currentKey: Partial<SecretKey> | null = null;
    let lastRecordType = "";

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
        lastRecordType = "sec";
      } else if (fields[0] === "uid" && currentKey) {
        const userId = fields[9] || "";
        if (userId) {
          currentKey.userIds?.push(userId);
          if (!currentKey.userId) {
            currentKey.userId = userId;
          }
        }
      } else if (fields[0] === "ssb") {
        lastRecordType = "ssb";
      } else if (
        fields[0] === "fpr" &&
        currentKey &&
        fields[9] &&
        lastRecordType === "sec"
      ) {
        currentKey.fingerprint = fields[9];
      }
    }

    if (currentKey?.keyId) {
      keys.push(currentKey as SecretKey);
    }

    return keys;
  }

  /**
   * Converts a Unix timestamp string to ISO date format (YYYY-MM-DD).
   * Returns null for invalid or zero timestamps.
   */
  private parseTimestamp(timestamp: string): string | null {
    const ts = Number.parseInt(timestamp, 10);
    if (Number.isNaN(ts) || ts === 0) return null;

    return new Date(ts * 1000).toISOString().split("T")[0] ?? null;
  }

  /**
   * Executes a GPG command with the configured GNUPGHOME environment.
   * Use this for custom GPG operations not covered by other methods.
   */
  async exec(
    args: Stringifiable[] = [],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult, CommandFailedError | Error>> {
    if (!this.getCommand()) return ErrFromText("GPG binary not resolved");

    return await Neu.exec({
      cmd: this.getCommand(),
      args,
      options: this.homeDir
        ? { ...options, envs: { GNUPGHOME: this.homeDir } }
        : options,
    });
  }
}

const Gpg = new GpgService();
const gpgInitialized = Gpg.init();

export { Gpg, GpgService, gpgInitialized };
