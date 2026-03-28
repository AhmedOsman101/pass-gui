/**
 * Core global settings for the application.
 */
type CoreConfig = {
  active_store: string;
};

/**
 * User preferences for application behavior.
 */
type PreferencesConfig = {
  clipboard_timeout_seconds: number;
  auto_refresh_interval_ms: number;
};

/**
 * Password generation configuration.
 */
type GenerateConfig = {
  default_length: number;
  symbols: boolean;
};

/**
 * Clipboard configuration.
 */
type ClipboardConfig = {
  clear_timeout: number;
};

/**
 * Configuration for a single password store.
 * Each store can have its own path and custom GNUPGHOME.
 */
type StoreConfig = {
  path: string;
  gnupg_home?: string;
};

/**
 * Root application configuration structure.
 * Supports multiple password stores with per-store configuration.
 */
type AppConfig = {
  core: CoreConfig;
  preferences: PreferencesConfig;
  generate: GenerateConfig;
  clipboard: ClipboardConfig;
  stores: Record<string, StoreConfig>;
};

/**
 * Configuration sections for generic get/set access.
 * Note: stores is handled separately due to its dynamic nature.
 */
type ConfigSection = "core" | "preferences" | "generate" | "clipboard";

/**
 * Union type of all valid config keys across sections.
 */
type ConfigKey =
  | keyof CoreConfig
  | keyof PreferencesConfig
  | keyof GenerateConfig
  | keyof ClipboardConfig;

/**
 * Type for config value by section and key.
 */
type ConfigValue =
  | CoreConfig[keyof CoreConfig]
  | PreferencesConfig[keyof PreferencesConfig]
  | GenerateConfig[keyof GenerateConfig]
  | ClipboardConfig[keyof ClipboardConfig];

export type {
  CoreConfig,
  PreferencesConfig,
  GenerateConfig,
  ClipboardConfig,
  StoreConfig,
  AppConfig,
  ConfigSection,
  ConfigKey,
  ConfigValue,
};
