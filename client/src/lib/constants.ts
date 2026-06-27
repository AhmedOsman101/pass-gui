import type { Version } from "@/types";
import type { AppConfig } from "@/types/config";

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
    active_store: "default",
  },
  preferences: {
    auto_refresh_interval_ms: 5000,
  },
  generation: {
    default_length: 25,
    symbols: true,
    character_set: "[:punct:][:alnum:]",
    character_set_no_symbols: "[:alnum:]",
  },
  clipboard: {
    clear_after_seconds: 45,
    selection: "clipboard",
  },
  gpg: {
    opts: [],
  },
  extensions: {
    enabled: false,
  },
  stores: {
    default: {
      path: "~/.password-store",
    },
  },
};

export { DEFAULT_CONFIG, PASS_MIN_VERSION, SYSTEM_PASS_PATHS };
