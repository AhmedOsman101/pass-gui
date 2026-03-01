import type { AppConfig, Version } from "@/types";

/**
 * Minimum supported version of the pass password manager.
 */
const PASS_MIN_VERSION: Version = { major: 1, minor: 7, patch: 0 };

/**
 * Known system paths where pass is typically installed.
 * Used to distinguish system binaries from custom wrappers/scripts.
 */
const SYSTEM_PASS_PATHS = ["/usr/bin/pass", "/bin/pass"];

/**
 * Default application configuration.
 * This configuration is used when no config file exists.
 */
const DEFAULT_CONFIG: AppConfig = {
  core: {
    default_store: "default",
  },
  preferences: {
    clipboard_timeout_seconds: 30,
    auto_refresh_interval_ms: 5000,
  },
  generate: {
    default_length: 25,
    symbols: true,
  },
  clipboard: {
    clear_timeout: 45,
  },
  stores: {
    default: {
      path: "~/.password-store",
    },
  },
};

export { PASS_MIN_VERSION, SYSTEM_PASS_PATHS, DEFAULT_CONFIG };
