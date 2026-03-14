import * as TOML from "@ltd/j-toml";
import { Err, Ok, type Result, wrapAsync } from "lib-result";
import { DEFAULT_CONFIG } from "@/lib/constants";
import {
  ConfigParseError,
  ConfigValidationError,
  ConfigWriteError,
} from "@/lib/errors";
import { expandTilde } from "@/lib/utils";
import type {
  AppConfig,
  ConfigSection,
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
  static async load(): Promise<Result<AppConfig>> {
    const existsResult = await ConfigService.exists();
    if (existsResult.isError()) return Err(existsResult.error);

    // Return default config if file doesn't exist
    if (!existsResult.ok) {
      return Ok(DEFAULT_CONFIG);
    }

    const configPath = await ConfigService.getPath();
    if (configPath.isError()) return Err(configPath.error);

    // Read and parse the config file
    const readResult = await fs.readFile(configPath.ok);
    if (readResult.isError()) return Err(readResult.error);

    try {
      return Ok(TOML.parse(readResult.ok) as AppConfig);
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

    // Ensure the directory exists using getPathParts
    const parts = await fs.getPathParts(configPath.ok);
    if (parts.isError()) return Err(parts.error);
    const dirPath = parts.ok.parentPath;
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
   * Generic typed getter for configuration values.
   * Provides type-safe access to config sections and keys.
   *
   * @param section - The config section to query (core, preferences, generate, clipboard)
   * @param key - The specific key within the section
   * @returns Result containing the config value or an error
   */
  static async getValue<S extends ConfigSection, K extends keyof AppConfig[S]>(
    section: S,
    key: K
  ): Promise<Result<AppConfig[S][K]>> {
    const configResult = await ConfigService.load();
    if (configResult.isError()) return Err(configResult.error);

    const config = configResult.ok;
    const value = config[section]?.[key];
    const defaultValue = DEFAULT_CONFIG[section]?.[key];

    return Ok((value !== undefined ? value : defaultValue) as AppConfig[S][K]);
  }

  /**
   * Generic typed setter for configuration values.
   * Provides type-safe updates to config sections and keys.
   *
   * @param section - The config section to update (core, preferences, generate, clipboard)
   * @param key - The specific key within the section
   * @param value - The value to set
   * @returns Result containing void or an error
   */
  static async setValue<S extends ConfigSection, K extends keyof AppConfig[S]>(
    section: S,
    key: K,
    value: AppConfig[S][K]
  ): Promise<Result<void>> {
    const configResult = await ConfigService.load();
    if (configResult.isError()) return Err(configResult.error);

    const config = configResult.ok;
    const updatedConfig: AppConfig = {
      ...config,
      [section]: {
        ...config[section],
        [key]: value,
      },
    };

    return await ConfigService.save(updatedConfig);
  }

  /**
   * Gets the name of the active store.
   * Returns the default store name if not set.
   *
   * @returns Result containing the active store name or an error
   */
  static async getActiveStore(): Promise<Result<string>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    const activeStore = config.ok.core?.default_store ?? "default";
    return Ok(activeStore);
  }

  /**
   * Sets the active store by name.
   *
   * @param name - The name of the store to set as active
   * @returns Result containing void or an error
   */
  static async setActiveStore(name: string): Promise<Result<void>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    // Verify the store exists
    if (!config.ok.stores?.[name]) {
      return Err(
        new ConfigValidationError("store", `Store '${name}' does not exist`)
      );
    }

    const updatedConfig: AppConfig = {
      ...config.ok,
      core: {
        ...config.ok.core,
        default_store: name,
      },
    };

    return await ConfigService.save(updatedConfig);
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
    const config = await ConfigService.load();
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

    const homeDir = await neu.getHomeDir();
    return Ok(expandTilde(store.ok.path, homeDir));
  }

  /**
   * Gets the GNUPGHOME path for a specific store.
   * Expands the tilde (~) to the user's home directory if set.
   *
   * @param name - The name of the store
   * @returns Result containing the expanded GNUPGHOME path or undefined if not set
   */
  static async getStoreGnupgHome(
    name: string
  ): Promise<Result<string | undefined>> {
    const store = await ConfigService.getStore(name);
    if (store.isError()) return Err(store.error);

    if (!store.ok) {
      return Err(
        new ConfigValidationError("store", `Store '${name}' not found`)
      );
    }

    if (!store.ok.gnupg_home) {
      return Ok(undefined);
    }

    const homeDir = await neu.getHomeDir();
    const expandedPath = expandTilde(store.ok.gnupg_home, homeDir);
    return Ok(expandedPath);
  }

  /**
   * Adds or updates a store configuration.
   *
   * @param name - The name of the store
   * @param storeConfig - The store configuration to set
   * @returns Result containing void or an error
   */
  static async setStore(
    name: string,
    storeConfig: StoreConfig
  ): Promise<Result<void>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    const updatedConfig: AppConfig = {
      ...config.ok,
      stores: {
        ...config.ok.stores,
        [name]: storeConfig,
      },
    };

    return await ConfigService.save(updatedConfig);
  }

  /**
   * Removes a store configuration.
   * Cannot remove the active store.
   *
   * @param name - The name of the store to remove
   * @returns Result containing void or an error
   */
  static async removeStore(name: string): Promise<Result<void>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    const activeStore = config.ok.core?.default_store ?? "default";
    if (name === activeStore) {
      return Err(
        new ConfigValidationError("store", "Cannot remove the active store")
      );
    }

    if (!config.ok.stores?.[name]) {
      return Ok(undefined); // Already doesn't exist
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [name]: _, ...remainingStores } = config.ok.stores ?? {};

    const updatedConfig: AppConfig = {
      ...config.ok,
      stores: remainingStores,
    };

    return await ConfigService.save(updatedConfig);
  }

  /**
   * Gets all store names.
   *
   * @returns Result containing array of store names or an error
   */
  static async getStores(): Promise<Result<string[]>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    const storeNames = Object.keys(config.ok.stores ?? {});
    return Ok(storeNames);
  }

  /**
   * Gets user preferences.
   *
   * @returns Result containing PreferencesConfig or an error
   */
  static async getPreferences(): Promise<Result<PreferencesConfig>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    const preferences = config.ok.preferences;
    return Ok(preferences ?? DEFAULT_CONFIG.preferences);
  }

  /**
   * Updates user preferences.
   *
   * @param preferences - Partial preferences to update
   * @returns Result containing void or an error
   */
  static async setPreferences(
    preferences: Partial<PreferencesConfig>
  ): Promise<Result<void>> {
    const config = await ConfigService.load();
    if (config.isError()) return Err(config.error);

    const defaultPrefs = DEFAULT_CONFIG.preferences;
    const currentPrefs = config.ok.preferences ?? defaultPrefs;
    const mergedPrefs: PreferencesConfig = {
      clipboard_timeout_seconds:
        preferences.clipboard_timeout_seconds ??
        currentPrefs.clipboard_timeout_seconds ??
        defaultPrefs.clipboard_timeout_seconds,
      auto_refresh_interval_ms:
        preferences.auto_refresh_interval_ms ??
        currentPrefs.auto_refresh_interval_ms ??
        defaultPrefs.auto_refresh_interval_ms,
    };

    const updatedConfig: AppConfig = {
      ...config.ok,
      preferences: mergedPrefs,
    };

    return await ConfigService.save(updatedConfig);
  }
}

const config = ConfigService;
const configInitialized = ConfigService.ensure();

export { config, configInitialized, ConfigService };
