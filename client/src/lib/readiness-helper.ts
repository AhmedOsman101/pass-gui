import type { ReadinessIssue, ReadinessIssueCode } from "@/types/readiness";

/**
 * Maps each `ReadinessIssueCode` to its corresponding variant type.
 * Used to extract the context fields for a given code.
 */
type IssueByCode = {
  [C in ReadinessIssue["code"]]: Extract<ReadinessIssue, { code: C }>;
};

/**
 * Extracts the context fields (excluding `code` and `severity`)
 * for a given readiness issue code.
 */
type IssueFields<C extends ReadinessIssue["code"]> = Omit<
  IssueByCode[C],
  "code" | "severity"
>;

/**
 * Canonical severity mapping for every readiness issue code.
 * All codes default to `"blocking"` except `STORE_NO_ENTRIES`
 * which is `"info"`.
 */
const SEVERITY: Record<ReadinessIssueCode, "blocking" | "info"> = {
  PASS_BINARY_MISSING: "blocking",
  PASS_VERSION_TOO_OLD: "blocking",
  TREE_BINARY_MISSING: "blocking",
  GPG_BINARY_MISSING: "blocking",
  GPG_NO_SECRET_KEYS: "blocking",
  GPG_VERSION_TOO_OLD: "blocking",
  STORE_DIR_NOT_FOUND: "blocking",
  STORE_DIR_NOT_DIRECTORY: "blocking",
  STORE_GPG_ID_MISSING: "blocking",
  STORE_GPG_ID_EMPTY: "blocking",
  STORE_GPG_ID_PARSE_ERROR: "blocking",
  STORE_RECIPIENT_UNKNOWN: "blocking",
  STORE_BEHAVIORAL_CHECK_FAILED: "blocking",
  STORE_NO_ENTRIES: "info",
};

/**
 * Factory function for constructing `ReadinessIssue` instances.
 * TypeScript infers the `fields` parameter type based on the `code`,
 * ensuring type-safe construction of each variant.
 *
 * @example
 * issue("PASS_BINARY_MISSING")
 * // → { code: "PASS_BINARY_MISSING", severity: "blocking" }
 *
 * issue("STORE_RECIPIENT_UNKNOWN", { path: "/store", keyId: "DEADBEEF" })
 * // → { code: "STORE_RECIPIENT_UNKNOWN", severity: "blocking", path: "/store", keyId: "DEADBEEF" }
 *
 * issue("STORE_NO_ENTRIES", { path: "/store" })
 * // → { code: "STORE_NO_ENTRIES", severity: "info", path: "/store" }
 */
function issue<C extends ReadinessIssue["code"]>(
  code: C,
  fields?: IssueFields<C>
): ReadinessIssue {
  return { code, severity: SEVERITY[code], ...fields } as ReadinessIssue;
}

export { issue };
