import { Err, ErrFromText, Ok, type Result, wrapAsync } from "lib-result";
import { DEFAULT_CONFIG } from "@/lib/constants";
import {
  ConfigParseError,
  ConfigValidationError,
  ConfigWriteError,
} from "@/lib/errors";
import toml from "@/lib/toml";
import type {
  AppConfig,
  ConfigKey,
  ConfigSection,
  ConfigValue,
} from "@/types/config";
import type { ParsedToml } from "@/types/toml";
import { formatZodError, validateAppConfig } from "./config-validation";
import { fs } from "./filesystem";
import { neu } from "./neutralino";

/**
 * Configuration service for managing application settings.
 * Handles loading, saving, and managing multiple password stores
 * with per-store configuration options.
 *
 * Provides both generic typed get/set methods and convenience methods
 * for common operations.
 */
class ConfigService {
  /**
   * Resolves the path to the configuration file.
   * Uses platform-specific config directory:
   * - Linux: ~/.config/pass-gui/
   * - macOS: ~/Library/Application Support/pass-gui/
   * - Windows: %APPDATA%/pass-gui/
   *
   * @returns Result containing the config file path or an error
   */
  static async getPath(): Promise<Result<string>> {
    const configDir = await wrapAsync(neu.getConfigDir);
    if (configDir.isError()) return Err(configDir.error);

    return Ok(await fs.join(configDir.ok, "pass-gui", "config.toml"));
  }

  /**
   * Checks if the configuration file exists on disk.
   *
   * @returns Result containing boolean or an error
   */
  static async exists(): Promise<Result<boolean>> {
    const configPath = await ConfigService.getPath();
    if (configPath.isError()) return Err(configPath.error);

    return await fs.exists(configPath.ok);
  }

  /**
   * Loads the configuration from file or returns defaults.
   * Does not create a config file if it doesn't exist.
   *
   * @returns Result containing the AppConfig or an error
   */
  static async load(): Promise<Result<ParsedToml<AppConfig>>> {
    const ensureResult = await ConfigService.ensure();
    if (ensureResult.isError()) return Err(ensureResult.error);

    const configPath = await ConfigService.getPath();
    if (configPath.isError()) return Err(configPath.error);

    // Read and parse the config file
    const readResult = await fs.readFile(configPath.ok);
    if (readResult.isError()) return Err(readResult.error);

    const configResult = toml.parse<AppConfig>(readResult.ok);
    if (configResult.isError()) {
      return Err(
        new ConfigParseError(
          configResult.error,
          `Failed to parse config: ${configResult.error.message}`
        )
      );
    }

    // Validate the parsed config
    const validationResult = validateAppConfig(configResult.ok.data);
    if (validationResult.isError()) {
      return Err(
        new ConfigValidationError(
          formatZodError(validationResult.error),
          validationResult.error
        )
      );
    }

    return Ok(configResult.ok);
  }

  /**
   * Saves the configuration to the config file.
   * Creates the directory if it doesn't exist.
   *
   * IMPORTANT: For comment preservation, pass ParsedToml from load().
   * - Modify values via parsed._raw directly, not via parsed.data
   * - Then pass the full parsed object to save()
   *
   * @param content - ParsedToml from load()
   * @returns Result containing void or an error
   */
  static async save(content: ParsedToml<AppConfig>): Promise<Result<void>> {
    // Ensure the config exists
    const ensureResult = await ConfigService.ensure();
    if (ensureResult.isError()) return Err(ensureResult.error);

    const configPath = await ConfigService.getPath();
    if (configPath.isError()) return Err(configPath.error);

    // Validate before saving
    const validationResult = validateAppConfig(content.data);
    if (validationResult.isError()) {
      return Err(
        new ConfigValidationError(
          formatZodError(validationResult.error),
          validationResult.error
        )
      );
    }

    // Serialize to TOML
    const tomlContent = toml.stringify(content);
    if (tomlContent.isError()) return Err(tomlContent.error);

    // Write to file
    const writeResult = await fs.writeFile(configPath.ok, tomlContent.ok);
    if (writeResult.isError()) {
      return Err(
        new ConfigWriteError(
          configPath.ok,
          `Failed to write config: ${writeResult.error.message}`
        )
      );
    }

    return Ok(undefined);
  }

  /**
   * Ensures configuration exists, creating default if needed.
   * For initial creation, uses DEFAULT_CONFIG.
   */
  static async ensure(): Promise<Result<void>> {
    const existsResult = await ConfigService.exists();

    // Create default config if it doesn't exist
    if (existsResult.isError() || !existsResult.ok) {
      const configPath = await ConfigService.getPath();
      if (configPath.isError()) return Err(configPath.error);

      // Ensure directory exists
      const parts = await fs.getPathParts(configPath.ok);
      if (parts.isError()) return Err(parts.error);
      const dirPath = parts.ok.parentPath;

      const dirExists = await fs.isDirectory(dirPath);
      if (!dirExists.ok || dirExists.isError()) {
        const mkdirResult = await fs.mkdir(dirPath);
        if (mkdirResult.isError()) return Err(mkdirResult.error);
      }

      // For initial creation, validate default config before writing
      const validationResult = validateAppConfig(DEFAULT_CONFIG);
      if (validationResult.isError()) {
        return Err(
          new ConfigValidationError(
            `Default config validation failed: ${formatZodError(validationResult.error)}`,
            validationResult.error
          )
        );
      }

      // For initial creation, write a commented default config table
      const defaultConfigTable = toml.buildDefaultConfigTable(DEFAULT_CONFIG);
      const tomlContent = toml.stringify<AppConfig>(defaultConfigTable);
      if (tomlContent.isError()) return Err(tomlContent.error);

      const writeResult = await fs.writeFile(configPath.ok, tomlContent.ok);
      if (writeResult.isError()) {
        return Err(
          new ConfigWriteError(
            configPath.ok,
            `Failed to write default config: ${writeResult.error.message}`
          )
        );
      }
    }

    return Ok(undefined);
  }

  /**
   * Generic typed getter for configuration values.
   * Provides type-safe access to config sections and keys.
   *
   * @param section - The config section to query
   * @param key - The specific key within the section
   * @returns Result containing the config value or an error
   */
  static async getValue<S extends ConfigSection, K extends ConfigKey<S>>(
    section: S,
    key: K
  ): Promise<Result<ConfigValue<S, K>>> {
    const configResult = await ConfigService.load();
    if (configResult.isError()) return Err(configResult.error);

    const config = configResult.ok.data;
    const sectionConfig = config[section] as AppConfig[S] | undefined;
    const defaultSectionConfig = DEFAULT_CONFIG[section] as
      | AppConfig[S]
      | undefined;
    const value = sectionConfig?.[key];
    const defaultValue = defaultSectionConfig?.[key];

    return Ok(
      (value !== undefined ? value : defaultValue) as ConfigValue<S, K>
    );
  }

  /**
   * Generic typed setter for configuration values.
   * Provides type-safe updates to config sections and keys.
   *
   * @param section - The config section to update
   * @param key - The specific key within the section
   * @param value - The value to set
   * @returns Result containing void or an error
   */
  static async setValue<S extends ConfigSection, K extends ConfigKey<S>>(
    section: S,
    key: K,
    value: ConfigValue<S, K>
  ): Promise<Result<void>> {
    const configResult = await ConfigService.load();
    if (configResult.isError()) return Err(configResult.error);

    const parsed = configResult.ok;
    if (!parsed) return ErrFromText("Config not loaded");

    // Modify _raw directly via cast - preserves comments when saved
    const raw = parsed._raw as AppConfig;
    (raw[section] as Record<string, unknown>)[key as string] = value;

    return await ConfigService.save(parsed);
  }
}

const config = ConfigService;

export { ConfigService, config };
