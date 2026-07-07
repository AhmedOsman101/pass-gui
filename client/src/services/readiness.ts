import { CommandFailedError } from "@/lib/errors";
import { issue } from "@/lib/readiness-helper";
import type {
  ReadinessIssue,
  ReadinessSnapshot,
  ReadinessState,
} from "@/types/readiness";
import { Config } from "./config";
import { Fs } from "./filesystem";
import { Gpg } from "./gpg";
import { Neu } from "./neutralino";
import { Pass } from "./pass";
import { StoreValidation } from "./store-validation";

/**
 * Result of an individual readiness check.
 * Each private check method returns this shape so the orchestrator
 * can chain them, accumulate issues, and short-circuit on blocking states.
 */
type CheckResult = {
  state: ReadinessState;
  issues: ReadinessIssue[];
  stop: boolean;
};

const OK: CheckResult = { state: "READY", issues: [], stop: false };

/**
 * Orchestrates the application's readiness evaluation.
 * Walks the onboarding state machine by checking each dependency
 * (pass, tree, gpg, store) and returning a `ReadinessSnapshot`.
 *
 * Evaluation order is fixed. First blocking match wins
 * if pass is missing, we don't bother checking GPG keys.
 */
class Readiness {
  /**
   * Runs all readiness checks in strict order and returns a snapshot.
   * @param storePath - Absolute path to the password store directory.
   */
  static async check(storePath: string): Promise<ReadinessSnapshot> {
    const checks = [
      Readiness.checkPass(),
      Readiness.checkTree(),
      Readiness.checkGpg(),
      Readiness.checkGpgKeys(),
      Readiness.checkStore(storePath),
    ];

    const issues: ReadinessIssue[] = [];
    let state: ReadinessState = "READY";

    for (const result of checks) {
      const { state: checkState, issues: checkIssues, stop } = await result;
      issues.push(...checkIssues);
      if (stop) {
        state = checkState;
        break;
      }
    }

    if (state === "READY") {
      const emptyResult = await Readiness.checkStoreEmpty(storePath);
      issues.push(...emptyResult.issues);
      state = emptyResult.state;
    }

    return { state, issues, evaluatedAt: Date.now() };
  }

  /**
   * Checks pass binary existence and version.
   * Two failure modes:
   * - `passExists()` fails or returns false → binary missing
   * - `checkVersion()` errors → binary exists but is broken/unusable
   * - `checkVersion()` returns `valid: false` → version too old
   */
  private static async checkPass(): Promise<CheckResult> {
    const passExists = await Pass.passExists();
    if (passExists.isError() || !passExists.ok) {
      return {
        ...OK,
        state: "NEED_PASS",
        issues: [issue("PASS_BINARY_MISSING")],
        stop: true,
      };
    }

    const passVersion = await Pass.checkVersion();
    if (passVersion.isError()) {
      return {
        ...OK,
        state: "NEED_PASS",
        issues: [issue("PASS_BINARY_MISSING")],
        stop: true,
      };
    }
    if (!passVersion.ok.valid) {
      return {
        ...OK,
        state: "NEED_PASS",
        issues: [
          issue("PASS_VERSION_TOO_OLD", {
            found: passVersion.ok.found,
            expected: passVersion.ok.expected,
          }),
        ],
        stop: true,
      };
    }

    return OK;
  }

  /**
   * Checks tree binary existence on Linux/macOS.
   * Skipped on Windows (pass ls uses different mechanisms there).
   */
  private static async checkTree(): Promise<CheckResult> {
    if (Neu.OS === "Windows") return OK;

    const treeExists = await Neu.commandExists("tree");
    if (treeExists.isError() || !treeExists.ok) {
      return {
        ...OK,
        state: "NEED_TREE",
        issues: [issue("TREE_BINARY_MISSING")],
        stop: true,
      };
    }

    return OK;
  }

  /**
   * Checks GPG binary existence (gpg2 or gpg).
   */
  private static async checkGpg(): Promise<CheckResult> {
    const gpgExists = await Gpg.gpgExists();
    if (gpgExists.isError() || !gpgExists.ok) {
      return {
        ...OK,
        state: "NEED_GPG",
        issues: [issue("GPG_BINARY_MISSING")],
        stop: true,
      };
    }

    return OK;
  }

  /**
   * Checks that at least one secret key exists in the GPG keyring.
   */
  private static async checkGpgKeys(): Promise<CheckResult> {
    const keys = await Gpg.listSecretKeys();
    if (keys.isError() || keys.ok.length === 0) {
      return {
        ...OK,
        state: "GPG_NO_KEYS",
        issues: [issue("GPG_NO_SECRET_KEYS")],
        stop: true,
      };
    }

    return OK;
  }

  /**
   * Full store validation chain:
   * exists → isDir → .gpg-id exists → parse → verify recipients → behavioral check.
   * First blocking issue wins.
   */
  private static async checkStore(storePath: string): Promise<CheckResult> {
    const exists = await Fs.exists(storePath);
    if (exists.isError() || !exists.ok) {
      return {
        ...OK,
        state: "STORE_NOT_FOUND",
        issues: [issue("STORE_DIR_NOT_FOUND", { path: storePath })],
        stop: true,
      };
    }

    const isDir = await Fs.isDirectory(storePath);
    if (isDir.isError() || !isDir.ok) {
      return {
        ...OK,
        state: "STORE_NOT_FOUND",
        issues: [issue("STORE_DIR_NOT_DIRECTORY", { path: storePath })],
        stop: true,
      };
    }

    const gpgIdPath = await Fs.join(storePath, ".gpg-id");
    const gpgIdExists = await Fs.exists(gpgIdPath);
    if (gpgIdExists.isError() || !gpgIdExists.ok) {
      return {
        ...OK,
        state: "STORE_NO_GPG_ID",
        issues: [issue("STORE_GPG_ID_MISSING", { path: gpgIdPath })],
        stop: true,
      };
    }

    const recipients = await StoreValidation.parseGpgId(storePath);
    if (recipients.isError() || recipients.ok.length === 0) {
      return {
        ...OK,
        state: "STORE_GPG_ID_EMPTY",
        issues: [issue("STORE_GPG_ID_EMPTY", { path: gpgIdPath })],
        stop: true,
      };
    }

    const gnupgHome = await Readiness.resolveGnupgHome(storePath);

    const verification = await StoreValidation.verifyRecipients(
      recipients.ok,
      gnupgHome
    );
    if (verification.isError()) {
      return {
        ...OK,
        state: "STORE_GPG_ID_KEY_MISSING",
        issues: [
          issue("STORE_GPG_ID_PARSE_ERROR", {
            path: gpgIdPath,
            parseError: verification.error,
          }),
        ],
        stop: true,
      };
    }
    if (verification.ok.missingKeys.length > 0) {
      return {
        ...OK,
        state: "STORE_GPG_ID_KEY_MISSING",
        issues: verification.ok.missingKeys.map(keyId =>
          issue("STORE_RECIPIENT_UNKNOWN", { path: storePath, keyId })
        ),
        stop: true,
      };
    }

    const envs: Record<string, string> = { PASSWORD_STORE_DIR: storePath };
    if (gnupgHome) envs.GNUPGHOME = gnupgHome;

    const behavioral = await Pass.exec(["ls"], { envs });
    if (behavioral.isError()) {
      let stderr: string;
      if (behavioral.error instanceof CommandFailedError) {
        stderr = behavioral.error.stdErr;
      } else {
        stderr = behavioral.error.message;
      }
      return {
        ...OK,
        state: "STORE_GPG_ID_KEY_MISSING",
        issues: [
          issue("STORE_BEHAVIORAL_CHECK_FAILED", { path: storePath, stderr }),
        ],
        stop: true,
      };
    }

    return OK;
  }

  /**
   * Checks if the store has any password entries.
   * Only called if all blocking checks passed.
   */
  private static async checkStoreEmpty(
    storePath: string
  ): Promise<CheckResult> {
    const hasEntries = await StoreValidation.hasEntries(storePath);
    if (hasEntries.isOk() && !hasEntries.ok) {
      return {
        ...OK,
        state: "STORE_EMPTY",
        issues: [issue("STORE_NO_ENTRIES", { path: storePath })],
        stop: false,
      };
    }

    return OK;
  }

  /**
   * Resolves the effective GNUPGHOME for a store by looking up
   * the store's `gnupg_home` config field. Best-effort — returns
   * undefined if config isn't available or the store has no override.
   */
  private static async resolveGnupgHome(
    storePath: string
  ): Promise<string | undefined> {
    const config = await Config.load();
    if (config.isError()) return;

    const stores = config.ok.data.stores;
    for (const store of Object.values(stores)) {
      if (store.path === storePath && store.gnupg_home) {
        return store.gnupg_home;
      }
    }

    return;
  }
}

export { Readiness };
