import type { NeuErrorCode } from "@/lib/errors";

declare const __brand: unique symbol;
/**
 * A branded type constructor that adds a unique brand to a type.
 * Used to create distinct types from primitive types for type safety.
 * @example
 * type UserId = Brand<string, "userId">;
 * const userId = "abc" as UserId; // Type-safe string
 */
type Brand<T, Brand> = T & { [__brand]: Brand };

/**
 * Types that can be safely converted to string.
 */
type Stringifiable = string | number | boolean | bigint | null;

/**
 * Recursive type representing a file system tree structure.
 * Each item is either a string (file/folder name) or an array
 * where the first element is the folder name and rest are children.
 */
type FileSystemTree = Array<string | FileSystemTree>;

/**
 * Raw error object structure returned by NeutralinoJS.
 */
type NeuErrorObj = {
  code: NeuErrorCode;
  message: string;
};

/**
 * Supported operating system types.
 */
type OsType = "Linux" | "Darwin" | "Windows NT" | "Unknown";

/**
 * Semantic version representation.
 */
type Version = {
  major: number;
  minor: number;
  patch: number;
};

/**
 * Information about the pass binary after validation.
 */
type PassBinaryInfo = {
  path: string;
  isSystemBinary: boolean;
};

/**
 * Information about the GPG binary after validation.
 */
type GpgBinaryInfo = {
  path: string;
  command: string;
};

/**
 * Represents a GPG secret key with its metadata.
 */
type SecretKey = {
  keyId: string;
  fingerprint?: string;
  userId: string;
  userIds: string[];
  algorithm: string;
  creationDate: string | null;
  expirationDate: string | null;
};

/**
 * Commands allowed to be executed through the safeExec method.
 * This whitelist prevents arbitrary command execution.
 */
type AllowedCommand =
  | "pass"
  | "gpg"
  | "gpg2"
  | "type"
  | "ls"
  | "where.exe"
  | "which"
  | "readlink"
  | "file";

/**
 * Core global settings for the application.
 */
type CoreConfig = {
  default_store: string;
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
  NeuErrorObj,
  Stringifiable,
  OsType,
  Version,
  PassBinaryInfo,
  AllowedCommand,
  FileSystemTree,
  GpgBinaryInfo,
  SecretKey,
  CoreConfig,
  PreferencesConfig,
  GenerateConfig,
  ClipboardConfig,
  StoreConfig,
  AppConfig,
  ConfigSection,
  ConfigKey,
  ConfigValue,
  Brand,
};
