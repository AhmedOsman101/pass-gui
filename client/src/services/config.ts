import { Err, ErrFromText, Ok, type Result } from "lib-result";
import { DEFAULT_CONFIG } from "@/lib/constants";
import {
  ConfigParseError,
  ConfigValidationError,
  ConfigWriteError,
} from "@/lib/errors";
import { Logger } from "@/lib/logger";
import Path from "@/lib/path";
import toml from "@/lib/toml";
import type {
  AppConfig,
  ConfigKey,
  ConfigSection,
  ConfigValue,
} from "@/types/config";
import type { ParsedToml } from "@/types/toml";
import { formatZodError, validateAppConfig } from "./config-validation";
import { Fs } from "./filesystem";
import { Watcher } from "./watcher";

/**
 * Configuration service for managing application settings.
 * Handles loading, saving, and managing multiple password stores
 * with per-store configuration options.
 *
 * Provides both generic typed get/set methods and convenience methods
 * for common operations.
 */
class Config {
  private static _cachedResult: ParsedToml<AppConfig> | null = null;

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
    const configDir = await Path.getKnownPath("config");
    if (configDir.isError()) return Err(configDir.error);

    return Ok(await Fs.join(configDir.ok, "pass-gui", "config.toml"));
  }

  /**
   * Checks if the configuration file exists on disk.
   *
   * @returns Result containing boolean or an error
   */
  static async exists(): Promise<Result<boolean>> {
    const configPath = await Config.getPath();
    if (configPath.isError()) return Err(configPath.error);

    return await Fs.exists(configPath.ok);
  }

  /**
   * Loads the configuration from file or returns defaults.
   * Does not create a config file if it doesn't exist.
   *
   * @returns Result containing the AppConfig or an error
   */
  static async load(): Promise<Result<ParsedToml<AppConfig>>> {
    const ensureResult = await Config.ensure();
    if (ensureResult.isError()) {
      await Logger.error(
        `Config.load(): ensure failed: ${ensureResult.error.message}`
      );
      return Err(ensureResult.error);
    }

    const configPath = await Config.getPath();
    if (configPath.isError()) {
      await Logger.error(
        `Config.load(): failed to resolve config path: ${configPath.error.message}`
      );
      return Err(configPath.error);
    }

    // Lazy-init OS-native watcher for the config directory
    const dirResult = await Fs.getPathParts(configPath.ok);
    if (dirResult.isOk()) {
      await Watcher.watch("config", dirResult.ok.parentPath, "config.toml");
    }

    // Return cached result if file hasn't changed
    if (!Watcher.hasChanged("config") && Config._cachedResult) {
      return Ok(Config._cachedResult);
    }

    // File changed (or first load) — read from disk
    const result = await Config.loadFromDisk(configPath.ok);
    if (result.isError()) return Err(result.error);

    Config._cachedResult = result.ok;
    return Ok(result.ok);
  }

  /**
   * Raw disk read + parse + validate. Called by the watcher only
   * when the file's mtime has changed.
   */
  private static async loadFromDisk(
    configPath: string
  ): Promise<Result<ParsedToml<AppConfig>>> {
    const readResult = await Fs.readFile(configPath);
    if (readResult.isError()) {
      await Logger.error(
        `Config.loadFromDisk("${configPath}"): ${readResult.error.message}`
      );
      return Err(readResult.error);
    }

    const configResult = toml.parse<AppConfig>(readResult.ok);
    if (configResult.isError()) {
      await Logger.error(
        `Config.loadFromDisk("${configPath}"): ${configResult.error.message}`
      );
      return Err(
        new ConfigParseError(
          configResult.error,
          `Failed to parse config: ${configResult.error.message}`
        )
      );
    }

    const validationResult = validateAppConfig(configResult.ok.data);
    if (validationResult.isError()) {
      await Logger.error(
        `Config.loadFromDisk("${configPath}"): ${formatZodError(validationResult.error)}`
      );
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
    const ensureResult = await Config.ensure();
    if (ensureResult.isError()) {
      await Logger.error(
        `Config.save(): ensure failed: ${ensureResult.error.message}`
      );
      return Err(ensureResult.error);
    }

    const configPath = await Config.getPath();
    if (configPath.isError()) {
      await Logger.error(
        `Config.save(): failed to resolve config path: ${configPath.error.message}`
      );
      return Err(configPath.error);
    }

    // Validate exactly what will be serialized: writers mutate `_raw`
    // (to preserve comments) and stringify serializes `_raw` — `data`
    // is a stale snapshot that never sees those mutations.
    const validationResult = validateAppConfig(
      content._raw as unknown as AppConfig
    );
    if (validationResult.isError()) {
      await Logger.error(
        `Config.save("${configPath.ok}"): ${formatZodError(validationResult.error)}`
      );
      // The caller already mutated this parsed object's _raw — evict it
      // from the cache so the next load() re-reads last-good state from
      // disk instead of serving the rejected mutation.
      Watcher.invalidate("config");
      Config._cachedResult = null;
      return Err(
        new ConfigValidationError(
          formatZodError(validationResult.error),
          validationResult.error
        )
      );
    }

    // Serialize to TOML
    const tomlContent = toml.stringify(content);
    if (tomlContent.isError()) {
      await Logger.error(
        `Config.save("${configPath.ok}"): ${tomlContent.error.message}`
      );
      return Err(tomlContent.error);
    }

    // Write to file
    const writeResult = await Fs.writeFile(configPath.ok, tomlContent.ok);
    if (writeResult.isError()) {
      await Logger.error(
        `Config.save("${configPath.ok}"): ${writeResult.error.message}`
      );
      return Err(
        new ConfigWriteError(
          configPath.ok,
          `Failed to write config: ${writeResult.error.message}`
        )
      );
    }

    // Invalidate cache so next load() re-reads from disk
    Watcher.invalidate("config");
    Config._cachedResult = null;

    return Ok(undefined);
  }

  /**
   * Ensures configuration exists, creating default if needed.
   * For initial creation, uses DEFAULT_CONFIG.
   */
  static async ensure(): Promise<Result<void>> {
    const existsResult = await Config.exists();

    // Create default config if it doesn't exist
    if (existsResult.isError() || !existsResult.ok) {
      const configPath = await Config.getPath();
      if (configPath.isError()) return Err(configPath.error);

      // Ensure directory exists
      const parts = await Fs.getPathParts(configPath.ok);
      if (parts.isError()) return Err(parts.error);
      const dirPath = parts.ok.parentPath;

      const dirExists = await Fs.isDirectory(dirPath);
      if (!dirExists.ok || dirExists.isError()) {
        const mkdirResult = await Fs.mkdir(dirPath);
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

      const writeResult = await Fs.writeFile(configPath.ok, tomlContent.ok);
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
    const configResult = await Config.load();
    if (configResult.isError()) return Err(configResult.error);

    const config = configResult.ok.data;

    // Type assertion needed: TypeScript widens S to the full ConfigSection
    // union when evaluating indexed access, making it unable to verify that
    // K can index the resulting union type. The assertion is safe because
    // K is constrained to keyof AppConfig[S].
    const sectionConfig = config[section] as unknown as
      | {
          [P in K]: ConfigValue<S, P>;
        }
      | undefined;
    const defaultSectionConfig = DEFAULT_CONFIG[section] as unknown as
      | {
          [P in K]: ConfigValue<S, P>;
        }
      | undefined;

    const value = sectionConfig?.[key];
    const defaultValue = defaultSectionConfig?.[key];

    return Ok((value ?? defaultValue) as ConfigValue<S, K>);
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
    const configResult = await Config.load();
    if (configResult.isError()) return Err(configResult.error);

    const parsed = configResult.ok;
    if (!parsed) return ErrFromText("Config not loaded");

    // Modify _raw directly via cast - preserves comments when saved
    const raw = parsed._raw as AppConfig;
    (raw[section] as Record<string, unknown>)[key as string] = value;

    return await Config.save(parsed);
  }

  /**
   * Generic typed remover for configuration values.
   * Removes a key from a config section (e.g. deleting a store).
   *
   * @param section - The config section to query
   * @param key - The specific key within the section
   * @returns Result containing void or an error
   */
  static async removeValue<S extends ConfigSection, K extends ConfigKey<S>>(
    section: S,
    key: K
  ): Promise<Result<void>> {
    const configResult = await Config.load();
    if (configResult.isError()) return Err(configResult.error);

    const parsed = configResult.ok;
    if (!parsed) return ErrFromText("Config not loaded");

    const raw = parsed._raw as AppConfig;
    delete (raw[section] as Record<string, unknown>)[key as string];

    return await Config.save(parsed);
  }
}

export { Config };
