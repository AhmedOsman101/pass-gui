import type { Version } from "@/types";

/**
 * Minimum supported version of the pass password manager.
 */
const PASS_MIN_VERSION: Version = { major: 1, minor: 7, patch: 0 };

/**
 * Known system paths where pass is typically installed.
 * Used to distinguish system binaries from custom wrappers/scripts.
 */
const SYSTEM_PASS_PATHS = ["/usr/bin/pass", "/bin/pass"];

export { PASS_MIN_VERSION, SYSTEM_PASS_PATHS };
