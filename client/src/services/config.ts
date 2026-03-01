import * as TOML from "@ltd/j-toml";
import { Err, type Result, wrapAsync } from "lib-result";
import { DEFAULT_CONFIG } from "@/lib/constants";
import {
  ConfigParseError,
  ConfigValidationError,
  ConfigWriteError,
} from "@/lib/errors";
import { expandTilde } from "@/lib/utils";
import type {
  AppConfig,
  ClipboardConfig,
  ConfigKey,
  ConfigSection,
  CoreConfig,
  GenerateConfig,
  PreferencesConfig,
  StoreConfig,
} from "@/types";
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
  /** Cached configuration loaded from file or defaults. */
  private static cachedConfig: AppConfig | null = null;

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
    const configDirResult = await wrapAsync(neu.getConfigDir);
    if (configDirResult.isError()) return Err(configDirResult.error);

    const configDir = configDirResult.ok;
    const passGuiDirResult = await fs.join(configDir, "pass-gui");
    if (passGuiDirResult.isError()) return Err(passGuiDirResult.error);

    const configPathResult = await fs.join(passGuiDirResult.ok, "config.toml");
    if (configPathResult.isError()) return Err(configPathResult.error);

    return Ok(configPathResult.ok);
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
  static async load(): Promise<Result<AppConfig>> {
    const existsResult = await ConfigService.exists();
    if (existsResult.isError()) return Err(existsResult.error);

    // Return default config if file doesn't exist
    if (!existsResult.ok) {
      ConfigService.cachedConfig = DEFAULT_CONFIG;
      return Ok(DEFAULT_CONFIG);
    }

    const configPath = await ConfigService.getPath();
    if (configPath.isError()) return Err(configPath.error);

    // Read and parse the config file
    const readResult = await fs.readFile(configPath.ok);
    if (readResult.isError()) return Err(readResult.error);

    try {
      const parsed = TOML.parse(readResult.ok) as AppConfig;
      ConfigService.cachedConfig = parsed;
      return Ok(parsed);
    } catch (e) {
      const err = e as Error;
      return Err(
        new ConfigParseError(err, `Failed to parse config: ${err.message}`)
      );
    }
  }

  /**
   * Saves the configuration to the config file.
   * Creates the directory if it doesn't exist.
   *
   * @param appConfig - The configuration object to save
   * @returns Result containing void or an error
   */
  static async save(appConfig: AppConfig): Promise<Result<void>> {
    const configPath = await ConfigService.getPath();
    if (configPath.isError()) return Err(configPath.error);

    // Ensure the directory exists
    const dirPath = configPath.ok.substring(0, configPath.ok.lastIndexOf("/"));
    const dirExists = await fs.exists(dirPath);
    if (dirExists.isError()) return Err(dirExists.error);

    if (!dirExists.ok) {
      const mkdirResult = await fs.mkdir(dirPath);
      if (mkdirResult.isError()) return Err(mkdirResult.error);
    }

    // Serialize to TOML
    const tomlContent = TOML.stringify(appConfig, {
      newline: "\n",
      indent: 2,
    });

    // Write to file
    const writeResult = await fs.writeFile(configPath.ok, tomlContent);
    if (writeResult.isError()) {
      return Err(
        new ConfigWriteError(
          configPath.ok,
          `Failed to write config: ${writeResult.error.message}`
        )
      );
    }

    // Update cached config
    ConfigService.cachedConfig = appConfig;
    return Ok(undefined);
  }

  /**
   * Ensures configuration exists, creating default if needed.
   * Returns the current configuration.
   *
   * @returns Result containing the AppConfig or an error
   */
  static async ensure(): Promise<Result<AppConfig>> {
    const existsResult = await ConfigService.exists();
    if (existsResult.isError()) return Err(existsResult.error);

    // Create default config if it doesn't exist
    if (!existsResult.ok) {
      const saveResult = await ConfigService.save(DEFAULT_CONFIG);
      if (saveResult.isError()) return Err(saveResult.error);
    }

    // Load and return the config
    return await ConfigService.load();
  }

  /**
   * Gets the currently cached configuration.
   * Loads from file if not cached.
   *
   * @returns Result containing the AppConfig or an error
   */
  static async getConfig(): Promise<Result<AppConfig>> {
    if (ConfigService.cachedConfig) {
      return Ok(ConfigService.cachedConfig);
    }
    return await ConfigService.load();
  }

  /**
   * Gets the name of the active store.
   * Returns the default store name if not set.
   *
   * @returns Result containing the active store name or an error
   */
  static async getActiveStore(): Promise<Result<string>> {
    const config = await ConfigService.getConfig();
    if (config.isError()) return Err(config.error);

    const activeStore = config.ok.core?.default_store ?? "default";
    return Ok(activeStore);
  }
  /**
   * Gets configuration for a specific store.
   *
   * @param name - The name of the store
   * @returns Result containing the StoreConfig or undefined if not found
   */
  static async getStore(
    name: string
  ): Promise<Result<StoreConfig | undefined>> {
    const config = await ConfigService.getConfig();
    if (config.isError()) return Err(config.error);

    const store = config.ok.stores?.[name];
    return Ok(store);
  }

  /**
   * Gets the path for a specific store.
   * Expands the tilde (~) to the user's home directory.
   *
   * @param name - The name of the store
   * @returns Result containing the expanded store path or an error
   */
  static async getStorePath(name: string): Promise<Result<string>> {
    const store = await ConfigService.getStore(name);
    if (store.isError()) return Err(store.error);

    if (!store.ok) {
      return Err(
        new ConfigValidationError("store", `Store '${name}' not found`)
      );
    }

    return Ok(expandTilde(store.ok.path, neu.HOME_DIR));
  }
  /**
   * Gets all store names.
   *
   * @returns Result containing array of store names or an error
   */
  static async getStores(): Promise<Result<string[]>> {
    const config = await ConfigService.getConfig();
    if (config.isError()) return Err(config.error);

    const storeNames = Object.keys(config.ok.stores ?? {});
    return Ok(storeNames);
  }
  /**
   * Clears the cached configuration.
   * Useful for forcing a reload from disk.
   */
  static clearCache(): void {
    ConfigService.cachedConfig = null;
  }
}

const config = ConfigService;
const configInitialized = ConfigService.ensure();

export { config, configInitialized, ConfigService };
