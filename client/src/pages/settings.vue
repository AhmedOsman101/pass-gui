<script setup lang="ts">
import ClipboardTab from "@/components/settings/ClipboardTab.vue";
import ExtensionsTab from "@/components/settings/ExtensionsTab.vue";
import GenerationTab from "@/components/settings/GenerationTab.vue";
import GpgTab from "@/components/settings/GpgTab.vue";
import InfoTab from "@/components/settings/InfoTab.vue";
import StoresTab from "@/components/settings/StoresTab.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNotifyResult } from "@/composables/use-notify-result";
import { Config } from "@/services/config";
import { Gpg } from "@/services/gpg";
import { Neu } from "@/services/neutralino";
import { Pass } from "@/services/pass";
import { Store } from "@/services/store";
import type { AppConfig, StoreConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";
import { ArrowLeft } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

const config = ref<ParsedToml<AppConfig> | null>(null);
const configPath = ref("");
const isLoading = ref(true);
const loadError = ref<Error | null>(null);
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
// const preferencesForm = ref({});
const gpgForm = ref({ opts: [] as string[], signingKey: "", recipientKey: "" });
const extensionsForm = ref({ enabled: false });

async function loadConfig(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;

  const pathResult = await Config.getPath();
  if (pathResult.isOk()) configPath.value = pathResult.ok;

  const result = await Config.load();
  if (result.isError()) {
    // Persistent error branch replaces the page — a transient toast
    // would leave the user on an unusable white screen.
    loadError.value = result.error;
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
  clipboardForm.value.clearAfterSeconds = data.clipboard.clear_after_seconds;
  clipboardForm.value.selection = data.clipboard.selection;
  gpgForm.value.opts = Array.isArray(data.gpg.opts)
    ? [...(data.gpg.opts as string[])]
    : [];
  gpgForm.value.signingKey = data.gpg.signing_key ?? "";
  gpgForm.value.recipientKey = data.gpg.key ?? "";
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
    Neu.resolveBinaryPath("pass"),
    Pass.checkVersion(),
  ]);
  passInfo.value = {
    binary: passBinaryResult.isOk() ? passBinaryResult.ok : "Not found",
    version: passVersionResult.isOk()
      ? `${passVersionResult.ok.found.major}.${passVersionResult.ok.found.minor}.${passVersionResult.ok.found.patch}`
      : "Unknown",
    storeDir: Pass.storePath || "Not set",
  };

  isLoading.value = false;
}

onMounted(() => void loadConfig());

async function saveSection<S extends keyof AppConfig>(
  section: S,
  values: Partial<AppConfig[S]>
): Promise<void> {
  isSaving.value = true;
  const result = await Config.setValues(section, values);
  isSaving.value = false;
  useNotifyResult(result, {
    ok: `${String(section)} settings saved`,
    err: `Failed to save ${String(section)} settings`,
  });
}

async function saveStore(name: string, data: StoreConfig): Promise<void> {
  isSaving.value = true;
  const result = await Store.set(name, data);
  isSaving.value = false;
  useNotifyResult(result, {
    ok: `Store "${name}" saved`,
    err: `Failed to save store "${name}"`,
  });
}

async function deleteStore(name: string): Promise<void> {
  isSaving.value = true;
  const result = await Store.delete(name);
  isSaving.value = false;
  useNotifyResult(result, {
    ok: `Store "${name}" deleted`,
    err: `Failed to delete store "${name}"`,
  });
}

function handleSaveGeneral(): void {
  void saveSection("core", { active_store: generalForm.value.activeStore });
}

function handleSaveGeneration(): void {
  void saveSection("generation", {
    memorable: generationForm.value.memorable,
    default_length: generationForm.value.defaultLength,
    symbols: generationForm.value.symbols,
    character_set: generationForm.value.characterSet,
    character_set_no_symbols: generationForm.value.characterSetNoSymbols,
  });
}

function handleSaveClipboard(): void {
  void saveSection("clipboard", {
    clear_after_seconds: clipboardForm.value.clearAfterSeconds,
    selection: clipboardForm.value.selection,
  });
}

function handleSaveGpg(): void {
  // Empty string clears the optional key (setValues deletes undefined).
  void saveSection("gpg", {
    opts: gpgForm.value.opts,
    signing_key: gpgForm.value.signingKey || undefined,
    key: gpgForm.value.recipientKey || undefined,
  });
}

function handleSaveExtensions(): void {
  void saveSection("extensions", { enabled: extensionsForm.value.enabled });
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

      <div
        v-else-if="loadError"
        class="flex flex-col items-center justify-center gap-3 py-16"
      >
        <p class="text-sm font-medium text-destructive">
          Failed to load settings
        </p>
        <p class="max-w-md text-center font-mono text-xs text-muted-foreground">
          {{ loadError.message }}
        </p>
        <Button variant="outline" size="sm" @click="() => void loadConfig()">
          Retry
        </Button>
      </div>

      <Tabs v-else default-value="stores" class="w-full">
        <TabsList class="w-full justify-start">
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="generation">Generation</TabsTrigger>
          <TabsTrigger value="clipboard">Clipboard</TabsTrigger>
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
              @save-store="saveStore"
              @delete-store="deleteStore"
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
              v-model:character-set-no-symbols="
                generationForm.characterSetNoSymbols
              "
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

          <TabsContent value="gpg">
            <GpgTab
              v-model:opts="gpgForm.opts"
              v-model:signing-key="gpgForm.signingKey"
              v-model:recipient-key="gpgForm.recipientKey"
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
