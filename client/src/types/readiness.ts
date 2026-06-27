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

type ReadinessIssueSeverity = "blocking" | "info";

type ReadinessIssue =
  | { code: "GPG_BINARY_MISSING"; severity: "blocking" }
  | { code: "GPG_NO_SECRET_KEYS"; severity: "blocking" }
  | {
      code: "GPG_VERSION_TOO_OLD";
      severity: "blocking";
      found: Version;
      required: Version;
    }
  | { code: "PASS_BINARY_MISSING"; severity: "blocking" }
  | {
      code: "PASS_VERSION_TOO_OLD";
      severity: "blocking";
      found: Version;
      required: Version;
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
 * A point-in-time evaluation of the application's readiness state.
 */
type ReadinessSnapshot = {
  state: ReadinessState;
  issues: ReadinessIssue[];
  evaluatedAt: number;
};

export type {
  ReadinessIssue,
  ReadinessIssueSeverity,
  ReadinessSnapshot,
  ReadinessState,
};
