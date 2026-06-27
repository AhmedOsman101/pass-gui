import type { Version } from ".";

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

type ReadinessIssueCode =
  | "PASS_BINARY_MISSING"
  | "PASS_VERSION_TOO_OLD"
  | "TREE_BINARY_MISSING"
  | "GPG_BINARY_MISSING"
  | "GPG_NO_SECRET_KEYS"
  | "GPG_VERSION_TOO_OLD"
  | "STORE_DIR_NOT_FOUND"
  | "STORE_DIR_NOT_DIRECTORY"
  | "STORE_GPG_ID_MISSING"
  | "STORE_GPG_ID_EMPTY"
  | "STORE_GPG_ID_PARSE_ERROR"
  | "STORE_RECIPIENT_UNKNOWN"
  | "STORE_BEHAVIORAL_CHECK_FAILED"
  | "STORE_NO_ENTRIES";

type ReadinessIssueSeverity = "blocking" | "info";

type ReadinessIssue = {
  code: ReadinessIssueCode;
  severity: ReadinessIssueSeverity;
  context:
    | { found: Version; required: Version }
    | { path: string }
    | { path: string; parseError: Error }
    | { path: string; stderr: string }
    | { path: string; keyId: string };
};

/**
 * A point-in-time evaluation of the application's readiness state.
 */
type ReadinessSnapshot = {
  state: ReadinessState;
  issues: ReadinessIssue[];
  evaluatedAt: number;
};

export type {
  ReadinessIssue,
  ReadinessIssueCode,
  ReadinessIssueSeverity,
  ReadinessSnapshot,
  ReadinessState,
};
