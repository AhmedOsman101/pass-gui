/**
 * Core global settings for the application.
 */
type CoreConfig = {
  active_store: string;
};

/**
 * User preferences for application behavior.
 */
type PreferencesConfig = Record<never, never>;

/**
 * Password generation configuration.
 */
type GenerationConfig = {
  memorable: boolean;
  default_length: number;
  symbols: boolean;
  character_set: string;
  character_set_no_symbols: string;
};

/**
 * Clipboard configuration.
 */
type ClipboardConfig = {
  clear_after_seconds: number;
  selection: "clipboard" | "primary" | "secondary";
};

/**
 * GPG-related configuration that maps to supported pass CLI behavior.
 */
type GpgConfig = {
  opts: string[];
  signing_key?: string;
  key?: string;
};

/**
 * Pass extension-related configuration.
 */
type ExtensionsConfig = {
  enabled: boolean;
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
  preferences?: PreferencesConfig;
  generation: GenerationConfig;
  clipboard: ClipboardConfig;
  gpg: GpgConfig;
  extensions: ExtensionsConfig;
  stores: Record<string, StoreConfig>;
};

/**
 * All top-level configuration sections.
 */
type ConfigSection = keyof AppConfig;

/**
 * Valid config key for a given fixed config section.
 */
type ConfigKey<T extends ConfigSection> = keyof AppConfig[T];

/**
 * Type for config value by fixed section and key.
 */
type ConfigValue<
  T extends ConfigSection,
  K extends ConfigKey<T>,
> = AppConfig[T][K];

export type {
  AppConfig,
  ClipboardConfig,
  ConfigKey,
  ConfigSection,
  ConfigValue,
  CoreConfig,
  ExtensionsConfig,
  GenerationConfig,
  GpgConfig,
  PreferencesConfig,
  StoreConfig,
};
