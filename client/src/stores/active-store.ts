import { Err, Ok, type Result } from "lib-result";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import Path from "@/lib/path";
import { Config } from "@/services/config";
import { Pass } from "@/services/pass";
import {
  type AddStoreError,
  type CreateStoreError,
  Store,
} from "@/services/store";
import type { StoreConfig } from "@/types/config";

/**
 * Manages the active password store — which store is selected,
 * its resolved path, and its per-store config (e.g. custom GNUPGHOME).
 *
 * On load, reads `core.active_store` from config, resolves the path
 * via `Pass.storePath`, and exposes it to the rest of the app.
 */
const useActiveStoreStore = defineStore("active-store", () => {
  const storePath = ref<string | null>(null);
  const storeName = ref<string | null>(null);
  const isValidating = ref(false);
  const error = ref<Error | null>(null);
  const currentStoreConfig = ref<StoreConfig | null>(null);
  const stores = ref<Record<string, StoreConfig>>({});

  const hasStore = computed(() => storePath.value !== null);

  /**
   * Loads config and applies the named store as active.
   * `Pass.setStorePath` here is one of the two legitimate callers
   * (app startup / switching) — everything else uses scoped calls.
   */
  async function applyStore(name: string): Promise<Result<void, Error>> {
    const configResult = await Config.load();
    if (configResult.isError()) {
      return Err(
        new Error(`Failed to load config: ${configResult.error.message}`)
      );
    }

    stores.value = configResult.ok.data.stores;
    const storeCfg = configResult.ok.data.stores[name];
    if (!storeCfg) {
      return Err(new Error(`Store "${name}" not found in config`));
    }

    const resolved = await Path.resolveUserPath(storeCfg.path);
    if (resolved.isError()) {
      return Err(
        new Error(`Failed to resolve store path: ${resolved.error.message}`)
      );
    }

    currentStoreConfig.value = storeCfg;
    Pass.setStorePath(resolved.ok);
    storePath.value = resolved.ok;
    return Ok(undefined);
  }

  async function load(): Promise<void> {
    isValidating.value = true;
    error.value = null;

    const nameResult = await Config.getValue("core", "active_store");
    if (nameResult.isError()) {
      error.value = new Error(
        `Failed to read active store: ${nameResult.error.message}`
      );
    } else if (!nameResult.ok) {
      // active_store missing from both the file and DEFAULT_CONFIG —
      // nothing is configured, not an error to swallow.
      error.value = new Error("No active store configured");
    } else {
      storeName.value = nameResult.ok;
      const result = await applyStore(nameResult.ok);
      if (result.isError()) error.value = result.error;
    }

    isValidating.value = false;
  }

  async function switchStore(
    newStoreName: string
  ): Promise<Result<void, Error>> {
    isValidating.value = true;
    error.value = null;

    let result: Result<void, Error>;
    const setResult = await Config.setValue(
      "core",
      "active_store",
      newStoreName
    );
    if (setResult.isError()) {
      result = Err(
        new Error(`Failed to switch store: ${setResult.error.message}`)
      );
    } else {
      result = await applyStore(newStoreName);
      if (result.isOk()) storeName.value = newStoreName;
    }

    if (result.isError()) error.value = result.error;
    isValidating.value = false;
    return result;
  }

  /**
   * Creates a brand-new store via the `Store.create` recipe
   * (mkdir → pass init → config write) and registers it on success.
   */
  async function createStore(
    name: string,
    data: { path: string; gpgKeyId: string }
  ): Promise<Result<StoreConfig, CreateStoreError>> {
    const result = await Store.create(name, data);
    if (result.isOk()) {
      stores.value = { ...stores.value, [name]: result.ok };
    }
    return result;
  }

  /**
   * Adds an existing initialized store via the `Store.add` recipe
   * and registers it on success.
   */
  async function addStore(
    name: string,
    data: { path: string }
  ): Promise<Result<StoreConfig, AddStoreError>> {
    const result = await Store.add(name, data);
    if (result.isOk()) {
      stores.value = { ...stores.value, [name]: result.ok };
    }
    return result;
  }

  function getGpgHome(): string | undefined {
    return currentStoreConfig.value?.gnupg_home;
  }

  return {
    storePath,
    storeName,
    isValidating,
    error,
    stores,
    hasStore,
    currentStoreConfig,
    load,
    switchStore,
    createStore,
    addStore,
    getGpgHome,
  };
});

export { useActiveStoreStore };
