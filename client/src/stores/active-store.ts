import { defineStore } from "pinia";
import { computed, ref } from "vue";
import Path from "@/lib/path";
import { Config } from "@/services/config";
import { Pass } from "@/services/pass";
import type { StoreConfig } from "@/types/config";

/**
 * Manages the active password store — which store is selected,
 * its resolved path, and its per-store config (e.g. custom GNUPGHOME).
 *
 * On load, reads `core.active_store` from config, resolves the path
 * via `Pass.storeDirectory`, and exposes it to the rest of the app.
 */
const useActiveStoreStore = defineStore("active-store", () => {
  const storePath = ref<string | null>(null);
  const storeName = ref<string | null>(null);
  const isValidating = ref(false);
  const error = ref<string | null>(null);
  const currentStoreConfig = ref<StoreConfig | null>(null);

  const hasStore = computed(() => storePath.value !== null);

  async function load(): Promise<void> {
    isValidating.value = true;
    error.value = null;

    try {
      const nameResult = await Config.getValue("core", "active_store");
      if (nameResult.isError()) {
        error.value = `Failed to read active store: ${nameResult.error.message}`;
        return;
      }

      storeName.value = nameResult.ok;

      // Read the full config to get the store's path and settings
      const configResult = await Config.load();
      if (configResult.isError()) {
        error.value = `Failed to load config: ${configResult.error.message}`;
        return;
      }

      const storeCfg = configResult.ok.data.stores[nameResult.ok];
      if (!storeCfg) {
        error.value = `Store "${nameResult.ok}" not found in config`;
        return;
      }

      currentStoreConfig.value = storeCfg;
      const resolved = await Path.resolveUserPath(storeCfg.path);
      if (resolved.isError()) {
        error.value = `Failed to resolve store path: ${resolved.error.message}`;
        return;
      }
      Pass.setStorePath(resolved.ok);
      storePath.value = resolved.ok;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isValidating.value = false;
    }
  }

  async function switchTo(newStoreName: string): Promise<void> {
    isValidating.value = true;
    error.value = null;

    try {
      const setResult = await Config.setValue(
        "core",
        "active_store",
        newStoreName
      );
      if (setResult.isError()) {
        error.value = `Failed to switch store: ${setResult.error.message}`;
        return;
      }

      // Reload config to pick up the new store's path
      const configResult = await Config.load();
      if (configResult.isError()) {
        error.value = `Failed to reload config: ${configResult.error.message}`;
        return;
      }

      const storeCfg = configResult.ok.data.stores[newStoreName];
      if (!storeCfg) {
        error.value = `Store "${newStoreName}" not found in config`;
        return;
      }

      currentStoreConfig.value = storeCfg;
      const resolved = await Path.resolveUserPath(storeCfg.path);
      if (resolved.isError()) {
        error.value = `Failed to resolve store path: ${resolved.error.message}`;
        return;
      }
      Pass.setStorePath(resolved.ok);
      storePath.value = resolved.ok;
      storeName.value = newStoreName;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isValidating.value = false;
    }
  }

  function getGpgHome(): string | undefined {
    return currentStoreConfig.value?.gnupg_home;
  }

  return {
    storePath,
    storeName,
    isValidating,
    error,
    hasStore,
    currentStoreConfig,
    load,
    switchTo,
    getGpgHome,
  };
});

export { useActiveStoreStore };
