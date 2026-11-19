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
import { Neu, SECRET_MASK } from "./neutralino";

/**
 * A GPG key-management command prepared for both execution and display.
 * `args` and `stdin` are what actually run; `display` is the secret-free
 * string the Stream box shows. The passphrase/key material lives only in
 * `stdin` — never in `args`, a log, or a temp file.
 */
type GpgKeyCommand = {
  args: Stringifiable[];
  stdin?: string;
  display: string;
};

/** Live output sinks for a streamed GPG run. */
type GpgStreamCallbacks = {
  onStdOut?: (chunk: string) => void;
  onStdErr?: (chunk: string) => void;
};

/**
 * Error thrown by `GpgService.listSecretKeys()` and
 * `GpgService.listSecretKeysWithHome()`. Carries the GNUPGHOME the listing
 * ran against (`null` for the default keyring) and the underlying cause.
 */
class GpgKeyListError extends Error {
  public gnupgHome: string | null;
  constructor(gnupgHome: string | null, message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.gnupgHome = gnupgHome;
  }
}

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

  private initPromise: Promise<Result<boolean>> | null = null;

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
   * Lazy, deduped init driven by the gate. Concurrent callers share the
   * same in-flight promise; retries after failure.
   */
  async ensureInitialized(): Promise<Result<boolean>> {
    // Cheap fast-path: binary already resolved.
    if (this.command) return Ok(true);
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.init();
    const result = await this.initPromise;
    this.initPromise = null;
    return result;
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
    const versionMatch = output.match(/gpg \(GnuPG\) (\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      // Unparseable output — never report stale singleton state as Ok.
      this.version = { major: 0, minor: 0 };
      return Err(
        new VersionCheckError(
          false,
          this.version,
          GPG_MIN_VERSION,
          `Unparseable gpg --version output: ${output.slice(0, 200)}`
        )
      );
    }

    this.version.major = Number.parseInt(versionMatch[1], 10);
    this.version.minor = Number.parseInt(versionMatch[2], 10);
    this.version.patch = Number.parseInt(versionMatch[3], 10);

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
  async listSecretKeys(): Promise<Result<SecretKey[], GpgKeyListError>> {
    if (!this.getCommand()) {
      return Err(new GpgKeyListError(null, "GPG binary not resolved"));
    }

    const cmdResult = await Neu.safeExec({
      cmd: this.getCommand(),
      args: ["--list-secret-keys", "--with-colons", "--fixed-list-mode"],
    });

    if (cmdResult.isError()) {
      return Err(
        new GpgKeyListError(null, cmdResult.error.message, cmdResult.error)
      );
    }

    if (cmdResult.ok.exitCode !== 0) {
      return Err(
        new GpgKeyListError(
          null,
          `GPG list-secret-keys failed: ${cmdResult.ok.stdErr}`
        )
      );
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
  ): Promise<Result<SecretKey[], GpgKeyListError>> {
    const cmdResult = await Neu.exec({
      cmd: this.getCommand(),
      args: ["--list-secret-keys", "--with-colons", "--fixed-list-mode"],
      options: { envs: { GNUPGHOME: gnupgHome } },
    });

    if (cmdResult.isError()) {
      return Err(
        new GpgKeyListError(gnupgHome, cmdResult.error.message, cmdResult.error)
      );
    }

    if (cmdResult.ok.exitCode !== 0) {
      return Err(
        new GpgKeyListError(
          gnupgHome,
          `GPG list-secret-keys failed: ${cmdResult.ok.stdErr}`
        )
      );
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
   * Builds a `--quick-generate-key` run from form values. The passphrase
   * is carried on stdin only (`--passphrase-fd 0`); an empty passphrase
   * sends an empty line so GPG can create an unprotected key without
   * opening a pinentry prompt. An expiry adds `default default <expiry>`
   * so GPG keeps the default primary/subkey algorithms (gpg.man:392).
   */
  createKeyCommand(
    name: string,
    email: string,
    expiry: string,
    passphrase: string
  ): GpgKeyCommand {
    const args: Stringifiable[] = [
      "--batch",
      "--yes",
      "--pinentry-mode",
      "loopback",
      "--passphrase-fd",
      "0",
      "--quick-generate-key",
      `${name} <${email}>`,
    ];
    if (expiry !== "") args.push("default", "default", expiry);

    const display = Neu.buildDisplayCommand(this.getCommand(), args, {
      hideStdin: true,
    });
    return {
      args,
      stdin: `${passphrase}\n`,
      display: passphrase === "" ? display : `${display} ${SECRET_MASK}`,
    };
  }

  /**
   * Builds a file-based import run. The path is quoted by the command
   * builder; the key bytes are read by GPG from disk, not by this service.
   */
  importFileCommand(path: string): GpgKeyCommand {
    const args: Stringifiable[] = ["--batch", "--import", path];
    return { args, display: Neu.buildDisplayCommand(this.getCommand(), args) };
  }

  /**
   * Builds a paste-based import run. Armored key text goes on stdin and
   * is therefore absent from the display command; the trailing newline
   * terminates the final armor line for GPG.
   */
  importTextCommand(armored: string): GpgKeyCommand {
    const args: Stringifiable[] = ["--batch", "--import"];
    return {
      args,
      stdin: armored.endsWith("\n") ? armored : `${armored}\n`,
      display: Neu.buildDisplayCommand(this.getCommand(), args, {
        hideStdin: true,
      }),
    };
  }

  /**
   * Runs a prepared key-management command with the resolved GPG binary.
   * No GNUPGHOME is injected: readiness evaluates the default keyring,
   * so that is where a key must be created to clear GPG_NO_KEYS. Stores
   * with a custom gnupg_home are handled separately (#31).
   */
  async runKeyCommand(
    command: GpgKeyCommand,
    callbacks: GpgStreamCallbacks = {}
  ): Promise<Result<ExecCommandResult, Error>> {
    return await Neu.spawn({
      cmd: this.getCommand(),
      args: command.args,
      stdin: command.stdin,
      onStdOut: callbacks.onStdOut,
      onStdErr: callbacks.onStdErr,
    });
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
// Eager but now deduped via ensureInitialized — mount no longer blocks on it.
// Prefer `Gpg.ensureInitialized()` for gate-driven lazy init.
const gpgInitialized: Promise<Result<boolean>> = Gpg.ensureInitialized();

export {
  Gpg,
  type GpgKeyCommand,
  GpgKeyListError,
  GpgService,
  type GpgStreamCallbacks,
  gpgInitialized,
};
