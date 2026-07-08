<script setup lang="ts">
import { ArrowLeft } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Config } from "@/services/config";
import { Gpg } from "@/services/gpg";
import { Pass } from "@/services/pass";
import StoresTab from "@/components/settings/StoresTab.vue";
import GenerationTab from "@/components/settings/GenerationTab.vue";
import ClipboardTab from "@/components/settings/ClipboardTab.vue";
import PreferencesTab from "@/components/settings/PreferencesTab.vue";
import GpgTab from "@/components/settings/GpgTab.vue";
import ExtensionsTab from "@/components/settings/ExtensionsTab.vue";
import InfoTab from "@/components/settings/InfoTab.vue";
import type { AppConfig, StoreConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const config = ref<ParsedToml<AppConfig> | null>(null);
const configPath = ref("");
const isLoading = ref(true);
const isSaving = ref(false);

// GPG & Pass info
const gpgInfo = ref<{
  binary: string;
  version: string;
  homeDir: string;
  keyCount: number;
} | null>(null);
const passInfo = ref<{
  binary: string;
  version: string;
  storeDir: string;
} | null>(null);

// Form state
const generalForm = ref({ activeStore: "" });
const storesForm = ref<Record<string, StoreConfig>>({});
const generationForm = ref({
  memorable: false,
  defaultLength: 25,
  symbols: true,
  characterSet: "",
  characterSetNoSymbols: "",
});
const clipboardForm = ref({
  clearAfterSeconds: 45,
  selection: "clipboard" as "clipboard" | "primary" | "secondary",
});
const preferencesForm = ref({ autoRefreshIntervalMs: 5000 });
const gpgForm = ref({ opts: [] as string[], signingKey: "", key: "" });
const extensionsForm = ref({ enabled: false });

onMounted(async () => {
  const pathResult = await Config.getPath();
  if (pathResult.isOk()) configPath.value = pathResult.ok;

  const result = await Config.load();
  if (result.isError()) {
    toast.error("Failed to load config");
    isLoading.value = false;
    return;
  }

  config.value = result.ok;
  const data = result.ok.data;

  generalForm.value.activeStore = data.core.active_store;
  storesForm.value = JSON.parse(JSON.stringify(data.stores));
  generationForm.value.memorable = data.generation.memorable;
  generationForm.value.defaultLength = data.generation.default_length;
  generationForm.value.symbols = data.generation.symbols;
  generationForm.value.characterSet = data.generation.character_set;
  generationForm.value.characterSetNoSymbols =
    data.generation.character_set_no_symbols;
  clipboardForm.value.clearAfterSeconds =
    data.clipboard.clear_after_seconds;
  clipboardForm.value.selection = data.clipboard.selection;
  preferencesForm.value.autoRefreshIntervalMs =
    data.preferences.auto_refresh_interval_ms;
  gpgForm.value.opts = Array.isArray(data.gpg.opts)
    ? [...(data.gpg.opts as string[])]
    : [];
  gpgForm.value.signingKey = data.gpg.signing_key ?? "";
  gpgForm.value.key = data.gpg.key ?? "";
  extensionsForm.value.enabled = data.extensions.enabled;

  // Load system info
  const [binaryResult, versionResult, keysResult] = await Promise.all([
    Gpg.validateGpgBinary(),
    Gpg.checkVersion(),
    Gpg.listSecretKeys(),
  ]);
  gpgInfo.value = {
    binary: binaryResult.isOk() ? binaryResult.ok.path : "Not found",
    version: versionResult.isOk()
      ? `${versionResult.ok.found.major}.${versionResult.ok.found.minor}.${versionResult.ok.found.patch}`
      : "Unknown",
    homeDir: Gpg.homeDir || "Default",
    keyCount: keysResult.isOk() ? keysResult.ok.length : 0,
  };

  const [passBinaryResult, passVersionResult] = await Promise.all([
    Pass.validatePassBinary(),
    Pass.checkVersion(),
  ]);
  passInfo.value = {
    binary: passBinaryResult.isOk() ? passBinaryResult.ok.path : "Not found",
    version: passVersionResult.isOk()
      ? `${passVersionResult.ok.found.major}.${passVersionResult.ok.found.minor}.${passVersionResult.ok.found.patch}`
      : "Unknown",
    storeDir: Pass.storeDirectory || "Not set",
  };

  isLoading.value = false;
});

async function saveField<S extends keyof AppConfig>(
  section: S,
  key: keyof AppConfig[S],
  value: AppConfig[S][keyof AppConfig[S]],
): Promise<void> {
  isSaving.value = true;
  const result = await Config.setValue(section, key, value);
  isSaving.value = false;
  if (result.isError()) {
    toast.error(`Failed to save ${String(section)} settings`);
  } else {
    toast.success(`${String(section)} settings saved`);
  }
}

async function saveStores(): Promise<void> {
  isSaving.value = true;
  // Rewrite all stores at once via raw
  if (config.value) {
    const raw = config.value._raw as AppConfig;
    (raw.stores as Record<string, unknown>) = storesForm.value;
    const result = await Config.save(config.value);
    isSaving.value = false;
    if (result.isError()) {
      toast.error("Failed to save stores");
    } else {
      toast.success("Stores saved");
    }
  } else {
    isSaving.value = false;
  }
}

function handleSaveGeneral(): void {
  saveField("core", "active_store", generalForm.value.activeStore);
}

function handleSaveGeneration(): void {
  saveField("generation", "memorable", generationForm.value.memorable);
  saveField(
    "generation",
    "default_length",
    generationForm.value.defaultLength,
  );
  saveField("generation", "symbols", generationForm.value.symbols);
  saveField(
    "generation",
    "character_set",
    generationForm.value.characterSet,
  );
  saveField(
    "generation",
    "character_set_no_symbols",
    generationForm.value.characterSetNoSymbols,
  );
}

function handleSaveClipboard(): void {
  saveField(
    "clipboard",
    "clear_after_seconds",
    clipboardForm.value.clearAfterSeconds,
  );
  saveField("clipboard", "selection", clipboardForm.value.selection);
}

function handleSavePreferences(): void {
  saveField(
    "preferences",
    "auto_refresh_interval_ms",
    preferencesForm.value.autoRefreshIntervalMs,
  );
}

function handleSaveGpg(): void {
  saveField("gpg", "opts", gpgForm.value.opts);
  saveField("gpg", "signing_key", gpgForm.value.signingKey || undefined);
  saveField("gpg", "key", gpgForm.value.key || undefined);
}

function handleSaveExtensions(): void {
  saveField("extensions", "enabled", extensionsForm.value.enabled);
}
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="mx-auto max-w-3xl px-6 py-8">
      <div class="mb-6 flex items-center gap-3">
        <RouterLink
          to="/"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft class="size-4" />
        </RouterLink>
        <h1 class="text-2xl font-bold">Settings</h1>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-16">
        <span class="text-sm text-muted-foreground">Loading settings...</span>
      </div>

      <Tabs v-else default-value="general" class="w-full">
        <TabsList class="w-full justify-start">
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="generation">Generation</TabsTrigger>
          <TabsTrigger value="clipboard">Clipboard</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="gpg">GPG</TabsTrigger>
          <TabsTrigger value="extensions">Extensions</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <div class="mt-6">
          <TabsContent value="stores">
            <StoresTab
              :config="config!"
              v-model:stores="storesForm"
              v-model:active-store="generalForm.activeStore"
              :is-saving="isSaving"
              @save="saveStores"
              @save-active-store="handleSaveGeneral"
              @update-stores="storesForm = $event"
            />
          </TabsContent>

          <TabsContent value="generation">
            <GenerationTab
              v-model:memorable="generationForm.memorable"
              v-model:default-length="generationForm.defaultLength"
              v-model:symbols="generationForm.symbols"
              v-model:character-set="generationForm.characterSet"
              v-model:character-set-no-symbols="generationForm.characterSetNoSymbols"
              :is-saving="isSaving"
              @save="handleSaveGeneration"
            />
          </TabsContent>

          <TabsContent value="clipboard">
            <ClipboardTab
              v-model:clear-after-seconds="clipboardForm.clearAfterSeconds"
              v-model:selection="clipboardForm.selection"
              :is-saving="isSaving"
              @save="handleSaveClipboard"
            />
          </TabsContent>

          <TabsContent value="preferences">
            <PreferencesTab
              v-model:auto-refresh-interval-ms="preferencesForm.autoRefreshIntervalMs"
              :is-saving="isSaving"
              @save="handleSavePreferences"
            />
          </TabsContent>

          <TabsContent value="gpg">
            <GpgTab
              v-model:opts="gpgForm.opts"
              v-model:signing-key="gpgForm.signingKey"
              v-model:key="gpgForm.key"
              :is-saving="isSaving"
              @save="handleSaveGpg"
            />
          </TabsContent>

          <TabsContent value="extensions">
            <ExtensionsTab
              v-model:enabled="extensionsForm.enabled"
              :is-saving="isSaving"
              @save="handleSaveExtensions"
            />
          </TabsContent>

          <TabsContent value="info">
            <InfoTab
              :config="config!"
              :config-path="configPath"
              :gpg-info="gpgInfo"
              :pass-info="passInfo"
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  </div>
</template>
