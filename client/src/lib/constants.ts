import type { Version } from "@/types";
import type { AppConfig } from "@/types/config";

/**
 * Minimum supported version of the pass password manager.
 */
const PASS_MIN_VERSION: Version = { major: 1, minor: 7, patch: 0 };

/**
 * Minimum supported version of GnuPG
 */
const GPG_MIN_VERSION: Version = { major: 2, minor: 1 };

/**
 * Known system paths where pass is typically installed.
 * Used to distinguish system binaries from custom wrappers/scripts.
 */
const SYSTEM_PASS_PATHS = [
  "/usr/bin/pass",
  "/bin/pass",
  "C:\\Program Files\\Gpg4win\\bin",
  "C:\\Program Files (x86)\\Gpg4win\\bin",
];

/**
 * Default application configuration.
 * This configuration is used when no config file exists.
 */
const DEFAULT_CONFIG: AppConfig = {
  core: {
    active_store: "default",
  },
  preferences: {},
  generation: {
    memorable: false,
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

export { DEFAULT_CONFIG, GPG_MIN_VERSION, PASS_MIN_VERSION, SYSTEM_PASS_PATHS };
