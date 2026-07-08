<script setup lang="ts">
import { ArrowLeft, Copy, Check } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Config } from "@/services/config";
import { Gpg } from "@/services/gpg";
import { Pass } from "@/services/pass";
import type { AppConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const router = useRouter();

const config = ref<ParsedToml<AppConfig> | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);
const copied = ref(false);

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

// Form state (local reactive copies)
const generalForm = ref({
  activeStore: "",
});
const generationForm = ref({
  defaultLength: 25,
  symbols: true,
});
const clipboardForm = ref({
  clearAfterSeconds: 45,
  selection: "clipboard" as "clipboard" | "primary" | "secondary",
});

const storeNames = computed(() => {
  if (!config.value) return [];
  return Object.keys(config.value.data.stores);
});

onMounted(async () => {
  const result = await Config.load();
  if (result.isError()) {
    toast.error("Failed to load config");
    isLoading.value = false;
    return;
  }

  config.value = result.ok;
  const data = result.ok.data;

  generalForm.value.activeStore = data.core.active_store;
  generationForm.value.defaultLength = data.generation.default_length;
  generationForm.value.symbols = data.generation.symbols;
  clipboardForm.value.clearAfterSeconds = data.clipboard.clear_after_seconds;
  clipboardForm.value.selection = data.clipboard.selection;

  // Load GPG info
  const binaryResult = await Gpg.validateGpgBinary();
  const versionResult = await Gpg.checkVersion();
  const keysResult = await Gpg.listSecretKeys();

  gpgInfo.value = {
    binary: binaryResult.isOk() ? binaryResult.ok.path : "Not found",
    version: versionResult.isOk()
      ? `${versionResult.ok.found.major}.${versionResult.ok.found.minor}.${versionResult.ok.found.patch}`
      : "Unknown",
    homeDir: Gpg.homeDir || "Default",
    keyCount: keysResult.isOk() ? keysResult.ok.length : 0,
  };

  // Load Pass info
  const passBinaryResult = await Pass.validatePassBinary();
  const passVersionResult = await Pass.checkVersion();

  passInfo.value = {
    binary: passBinaryResult.isOk() ? passBinaryResult.ok.path : "Not found",
    version: passVersionResult.isOk()
      ? `${passVersionResult.ok.found.major}.${passVersionResult.ok.found.minor}.${passVersionResult.ok.found.patch}`
      : "Unknown",
    storeDir: Pass.storeDirectory || "Not set",
  };

  isLoading.value = false;
});

async function saveGeneral(): Promise<void> {
  if (!config.value) return;
  isSaving.value = true;
  const result = await Config.setValue(
    "core",
    "active_store",
    generalForm.value.activeStore,
  );
  isSaving.value = false;
  if (result.isError()) {
    toast.error("Failed to save general settings");
  } else {
    toast.success("General settings saved");
  }
}

async function saveGeneration(): Promise<void> {
  if (!config.value) return;
  isSaving.value = true;

  await Config.setValue(
    "generation",
    "default_length",
    generationForm.value.defaultLength,
  );
  await Config.setValue(
    "generation",
    "symbols",
    generationForm.value.symbols,
  );

  isSaving.value = false;
  toast.success("Generation settings saved");
}

async function saveClipboard(): Promise<void> {
  if (!config.value) return;
  isSaving.value = true;

  await Config.setValue(
    "clipboard",
    "clear_after_seconds",
    clipboardForm.value.clearAfterSeconds,
  );
  await Config.setValue(
    "clipboard",
    "selection",
    clipboardForm.value.selection,
  );

  isSaving.value = false;
  toast.success("Clipboard settings saved");
}

function buildInfoText(): string {
  const lines: string[] = [];
  if (passInfo.value) {
    lines.push(`pass_version: ${passInfo.value.version}`);
    lines.push(`pass_binary: ${passInfo.value.binary}`);
    lines.push(`store_directory: ${passInfo.value.storeDir}`);
  }
  if (gpgInfo.value) {
    lines.push(`gpg_version: ${gpgInfo.value.version}`);
    lines.push(`gpg_binary: ${gpgInfo.value.binary}`);
    lines.push(`gpg_home: ${gpgInfo.value.homeDir}`);
    lines.push(`gpg_secret_keys: ${gpgInfo.value.keyCount}`);
  }
  if (config.value) {
    lines.push(`active_store: ${config.value.data.core.active_store}`);
  }
  lines.push(`app_version: 0.0.1`);
  lines.push(`license: GPL-3.0-or-later`);
  lines.push(
    `repository: https://github.com/AhmedOsman101/pass-gui`,
  );
  lines.push(`author: Ahmad Othman`);
  return lines.join("\n");
}

async function copyInfo(): Promise<void> {
  try {
    await navigator.clipboard.writeText(buildInfoText());
    copied.value = true;
    toast.success("Info copied to clipboard");
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    toast.error("Failed to copy info");
  }
}
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="mx-auto max-w-2xl px-6 py-8">
      <div class="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          @click="router.push('/')"
        >
          <ArrowLeft class="size-4" />
        </Button>
        <h1 class="text-2xl font-bold">Settings</h1>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-16">
        <span class="text-sm text-muted-foreground">Loading settings...</span>
      </div>

      <Tabs v-else default-value="general" class="w-full">
        <TabsList class="w-full justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="generation">Generation</TabsTrigger>
          <TabsTrigger value="clipboard">Clipboard</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <!-- General -->
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <Label for="active-store">Active Store</Label>
                <Select v-model="generalForm.activeStore">
                  <SelectTrigger id="active-store" class="w-full">
                    <SelectValue placeholder="Select a store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        v-for="name in storeNames"
                        :key="name"
                        :value="name"
                      >
                        {{ name }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">
                  Which password store is currently active.
                </p>
              </div>
              <Separator />
              <div class="flex justify-end">
                <Button :disabled="isSaving" @click="saveGeneral">
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Generation -->
        <TabsContent value="generation">
          <Card>
            <CardHeader>
              <CardTitle>Generation</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <Label for="default-length">Default Password Length</Label>
                <Input
                  id="default-length"
                  v-model.number="generationForm.defaultLength"
                  type="number"
                  :min="8"
                  :max="128"
                  class="w-full"
                />
                <p class="text-xs text-muted-foreground">
                  Length of generated passwords (8-128).
                </p>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex flex-col gap-1">
                  <Label for="symbols">Include Symbols</Label>
                  <p class="text-xs text-muted-foreground">
                    Add symbols to generated passwords.
                  </p>
                </div>
                <Switch
                  id="symbols"
                  v-model:checked="generationForm.symbols"
                />
              </div>
              <Separator />
              <div class="flex justify-end">
                <Button :disabled="isSaving" @click="saveGeneration">
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Clipboard -->
        <TabsContent value="clipboard">
          <Card>
            <CardHeader>
              <CardTitle>Clipboard</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <Label for="clear-after">Clear After (seconds)</Label>
                <Input
                  id="clear-after"
                  v-model.number="clipboardForm.clearAfterSeconds"
                  type="number"
                  :min="0"
                  class="w-full"
                />
                <p class="text-xs text-muted-foreground">
                  Seconds before clipboard is cleared. 0 to disable.
                </p>
              </div>
              <div class="flex flex-col gap-2">
                <Label for="selection">X Selection</Label>
                <Select v-model="clipboardForm.selection">
                  <SelectTrigger id="selection" class="w-full">
                    <SelectValue placeholder="Select a selection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="clipboard">clipboard</SelectItem>
                      <SelectItem value="primary">primary</SelectItem>
                      <SelectItem value="secondary">secondary</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">
                  X11 selection to use for copying.
                </p>
              </div>
              <Separator />
              <div class="flex justify-end">
                <Button :disabled="isSaving" @click="saveClipboard">
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Info -->
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>System Info</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">pass</span>
                <span class="text-sm font-mono">
                  {{ passInfo?.version || "Unknown" }}
                  <Badge variant="secondary" class="ml-2 text-xs">
                    {{ passInfo?.binary || "N/A" }}
                  </Badge>
                </span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">gpg</span>
                <span class="text-sm font-mono">
                  {{ gpgInfo?.version || "Unknown" }}
                  <Badge variant="secondary" class="ml-2 text-xs">
                    {{ gpgInfo?.binary || "N/A" }}
                  </Badge>
                </span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Active Store</span>
                <span class="text-sm font-mono">
                  {{ config?.data.core.active_store || "N/A" }}
                </span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Store Directory</span>
                <span class="text-sm font-mono">
                  {{ passInfo?.storeDir || "N/A" }}
                </span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">GPG Home</span>
                <span class="text-sm font-mono">
                  {{ gpgInfo?.homeDir || "N/A" }}
                </span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Secret Keys</span>
                <Badge variant="secondary">
                  {{ gpgInfo?.keyCount ?? 0 }}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card class="mt-4">
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Version</span>
                <span class="text-sm font-mono">0.0.1</span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">License</span>
                <span class="text-sm font-mono">GPL-3.0-or-later</span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Author</span>
                <span class="text-sm font-mono">Ahmad Othman</span>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Repository</span>
                <a
                  href="https://github.com/AhmedOsman101/pass-gui"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm font-mono text-primary underline-offset-4 hover:underline"
                >
                  AhmedOsman101/pass-gui
                </a>
              </div>
              <Separator />
              <Button
                variant="outline"
                class="mt-2 w-full"
                @click="copyInfo"
              >
                <Check v-if="copied" class="size-4 mr-2" />
                <Copy v-else class="size-4 mr-2" />
                {{ copied ? "Copied!" : "Copy Info to Clipboard" }}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
