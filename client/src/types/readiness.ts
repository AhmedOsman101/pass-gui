import type { Version } from ".";

/**
 * The 10 states of the onboarding state machine.
 * Each state represents a blocking condition that must be resolved
 * before the application can reach `READY`.
 */
type ReadinessState =
  | "NEED_PASS"
  | "NEED_TREE"
  | "NEED_GPG"
  | "GPG_NO_KEYS"
  | "STORE_NOT_FOUND"
  | "STORE_NO_GPG_ID"
  | "STORE_GPG_ID_EMPTY"
  | "STORE_GPG_ID_KEY_MISSING"
  | "STORE_EMPTY"
  | "READY";

/**
 * Severity of a readiness issue.
 * - `blocking`: prevents the application from proceeding
 * - `info`: informational, does not block startup
 */
type ReadinessIssueSeverity = "blocking" | "info";

/**
 * Discriminated union of all readiness issues.
 * Each variant has a unique `code` and `severity`, with optional
 * context fields specific to that issue type. Use the `issue()`
 * helper from `readiness-helper.ts` to construct instances.
 */
type ReadinessIssue =
  | { code: "GPG_BINARY_MISSING"; severity: "blocking" }
  | { code: "GPG_NO_SECRET_KEYS"; severity: "blocking" }
  | {
      code: "GPG_VERSION_TOO_OLD";
      severity: "blocking";
      found: Version;
      expected: Version;
    }
  | { code: "PASS_BINARY_MISSING"; severity: "blocking" }
  | {
      code: "PASS_VERSION_TOO_OLD";
      severity: "blocking";
      found: Version;
      expected: Version;
    }
  | {
      code: "STORE_BEHAVIORAL_CHECK_FAILED";
      severity: "blocking";
      path: string;
      stderr: string;
    }
  | { code: "STORE_DIR_NOT_DIRECTORY"; severity: "blocking"; path: string }
  | { code: "STORE_DIR_NOT_FOUND"; severity: "blocking"; path: string }
  | { code: "STORE_GPG_ID_EMPTY"; severity: "blocking"; path: string }
  | { code: "STORE_GPG_ID_MISSING"; severity: "blocking"; path: string }
  | {
      code: "STORE_GPG_ID_PARSE_ERROR";
      severity: "blocking";
      path: string;
      parseError: Error;
    }
  | { code: "STORE_NO_ENTRIES"; severity: "info"; path: string }
  | {
      code: "STORE_RECIPIENT_UNKNOWN";
      severity: "blocking";
      path: string;
      keyId: string;
    }
  | { code: "TREE_BINARY_MISSING"; severity: "blocking" };

/**
 * Union type of all possible issue codes, derived from `ReadinessIssue`.
 * Use this when you need to reference a code without its context fields.
 */
type ReadinessIssueCode = ReadinessIssue["code"];

/**
 * A point-in-time evaluation of the application's readiness state.
 * Produced by the readiness orchestrator and consumed by the UI layer
 * to display the appropriate onboarding screen or error state.
 */
type ReadinessSnapshot = {
  state: ReadinessState;
  issues: ReadinessIssue[];
  evaluatedAt: number;
};

/**
 * Result of a version check against a minimum required version.
 * Used by both `PassService.checkVersion()` and `GpgService.checkVersion()`.
 */
type VersionCheck = { valid: boolean; found: Version; expected: Version };

export type {
  ReadinessIssue,
  ReadinessIssueCode,
  ReadinessIssueSeverity,
  ReadinessSnapshot,
  ReadinessState,
  VersionCheck,
};
