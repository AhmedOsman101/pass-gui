<script lang="ts" setup>
import { ChevronRight, FolderOpen, Loader2 } from "@lucide/vue";
import type { Result } from "lib-result";
import { computed, ref, watch } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAsyncAction } from "@/composables/use-async-action";
import { useNotifyResult } from "@/composables/use-notify-result";
import { Logger } from "@/lib/logger";
import { Dialog as NeuDialog } from "@/services/dialog";
import { Gpg } from "@/services/gpg";
import type { AddStoreError, CreateStoreError } from "@/services/store";
import { StoreValidation } from "@/services/store-validation";
import { useActiveStoreStore } from "@/stores/active-store";
import type { SecretKey } from "@/types";
import type { StoreConfig } from "@/types/config";

const props = defineProps<{
  stores: Record<string, StoreConfig>;
  activeStore: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [store: { name: string; path: string }];
}>();

const activeStoreStore = useActiveStoreStore();

// Wizard state
type WizardStep = "name" | "path" | "gpg" | "creating";
const step = ref<WizardStep>("name");
const storeName = ref("");
const storePath = ref("");
const selectedKeyId = ref("");
const secretKeys = ref<SecretKey[]>([]);
const isLoadingKeys = ref(true);
const keysLoadError = ref<string | null>(null);
const isExistingStore = ref(false);
// Set when store detection failed — blocks advancing (fail closed:
// an undetectable path must never default to create mode).
const detectionError = ref<string | null>(null);

// Validation
const nameError = computed(() => {
  const name = storeName.value.trim();
  if (!name) return "";
  if (props.stores[name]) return "A store with this name already exists";
  if (!/^[a-zA-Z0-9_-]+$/.test(name))
    return "Name can only contain letters, numbers, hyphens, and underscores";
  return "";
});

const pathError = computed(() => {
  const path = storePath.value.trim();
  if (!path) return "";
  const existing = Object.values(props.stores).find(s => s.path === path);
  if (existing) return "A store with this path already exists";
  return "";
});

const canAdvanceName = computed(
  () => storeName.value.trim() !== "" && !nameError.value
);
const canAdvancePath = computed(
  () => storePath.value.trim() !== "" && !pathError.value
);
const canCreate = computed(
  () =>
    // Existing stores are added as-is — no key selection to gate on.
    (isExistingStore.value || selectedKeyId.value !== "") && !isCreating.value
);

/**
 * Single call into the active-store store — the recipe decides
 * between full creation (mkdir + pass init + config write) and
 * add-as-is (validation + config write).
 */
const {
  isLoading: isCreating,
  error: creationError,
  run: runCreateAction,
} = useAsyncAction(
  async (input: {
    name: string;
    path: string;
    gpgKeyId: string;
  }): Promise<Result<StoreConfig, CreateStoreError | AddStoreError>> =>
    isExistingStore.value
      ? activeStoreStore.addStore(input.name, { path: input.path })
      : activeStoreStore.createStore(input.name, input)
);

// Load GPG keys when dialog opens
watch(
  () => props.open,
  async isOpen => {
    if (isOpen) {
      await loadKeys();
    }
  }
);

async function loadKeys(): Promise<void> {
  isLoadingKeys.value = true;
  const result = await Gpg.listSecretKeys();
  if (result.isOk()) {
    secretKeys.value = result.ok;
    keysLoadError.value = null;
  } else {
    keysLoadError.value = result.error.message;
  }
  useNotifyResult(result, { ok: false });
  isLoadingKeys.value = false;
}

function keyLabel(key: SecretKey): string {
  const uid = key.userIds?.[0] ?? key.userId ?? "Unknown";
  const shortId = key.keyId.slice(-8);
  return `${uid} (${shortId})`;
}

async function pickFolder(): Promise<void> {
  const result = await NeuDialog.showFolderDialog("Select store directory");
  if (result.isOk() && result.ok) {
    storePath.value = result.ok;
    await detectExistingStore(result.ok);
  }
}

/**
 * Detects whether `path` is an already-initialized store. Returns false
 * (and sets `detectionError`) when detection itself fails — the wizard
 * must not guess create-mode on unknown state.
 */
async function detectExistingStore(path: string): Promise<boolean> {
  const result = await StoreValidation.validate(path);
  if (result.isOk()) {
    isExistingStore.value = result.ok.initialized;
    detectionError.value = null;
    return true;
  }
  Logger.error(
    `AddStoreWizard: store detection failed for "${path}": ${result.error.message}`
  );
  isExistingStore.value = false;
  detectionError.value = `Could not inspect "${path}": ${result.error.message}`;
  return false;
}

async function advanceStep(): Promise<void> {
  switch (step.value) {
    case "name":
      if (canAdvanceName.value) step.value = "path";
      break;
    case "path":
      if (canAdvancePath.value) {
        const detected = await detectExistingStore(storePath.value.trim());
        if (detected) step.value = "gpg";
      }
      break;
  }
}

function goBack(): void {
  switch (step.value) {
    case "path":
      step.value = "name";
      break;
    case "gpg":
      step.value = "path";
      break;
  }
}

async function createStore(): Promise<void> {
  if (!canCreate.value) return;
  step.value = "creating";

  const name = storeName.value.trim();
  const path = storePath.value.trim();

  const result = await runCreateAction({
    name,
    path,
    gpgKeyId: selectedKeyId.value,
  });

  useNotifyResult(result, {
    ok: () =>
      isExistingStore.value
        ? `Store "${name}" added`
        : `Store "${name}" created`,
  });

  if (result.isOk()) {
    emit("created", { name, path });
    emit("update:open", false);
    resetWizard();
  } else {
    step.value = "gpg";
  }
}

function resetWizard(): void {
  step.value = "name";
  storeName.value = "";
  storePath.value = "";
  selectedKeyId.value = "";
  isExistingStore.value = false;
  detectionError.value = null;
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add New Store</DialogTitle>
        <DialogDescription>
          Create a new password store with a GPG key for encryption.
        </DialogDescription>
      </DialogHeader>

      <!-- Step indicators -->
      <div class="text-muted-foreground flex items-center gap-2 text-xs">
        <Badge :variant="step === 'name' ? 'default' : 'outline'"
          >1. Name</Badge
        >
        <ChevronRight class="size-3" />
        <Badge :variant="step === 'path' ? 'default' : 'outline'"
          >2. Path</Badge
        >
        <ChevronRight class="size-3" />
        <Badge
          :variant="
            step === 'gpg' || step === 'creating' ? 'default' : 'outline'
          "
          >{{
            isExistingStore ? "3. Confirm" : "3. GPG Key"
          }}</Badge
        >
      </div>

      <Separator />

      <!-- Step: Name -->
      <div class="flex flex-col gap-3" v-if="step === 'name'">
        <Label for="store-name">Store Name</Label>
        <Input
          id="store-name"
          placeholder="my-store"
          v-model="storeName"
          @keydown.enter="advanceStep"
        />
        <p class="text-destructive text-xs" v-if="nameError">{{ nameError }}</p>
        <p class="text-muted-foreground text-xs" v-else>
          A unique identifier for this store (letters, numbers, hyphens,
          underscores).
        </p>
      </div>

      <!-- Step: Path -->
      <div class="flex flex-col gap-3" v-else-if="step === 'path'">
        <Label for="store-path">Store Directory</Label>
        <div class="flex gap-2">
          <Input
            class="flex-1 font-mono"
            id="store-path"
            placeholder="/home/user/.password-store"
            v-model="storePath"
            @keydown.enter="advanceStep"
          />
          <Button
            class="size-9 shrink-0"
            size="icon"
            variant="outline"
            @click="pickFolder"
          >
            <FolderOpen class="size-4" />
          </Button>
        </div>
        <p class="text-destructive text-xs" v-if="pathError">{{ pathError }}</p>
        <p class="text-destructive text-xs" v-else-if="detectionError">
          {{ detectionError }}
        </p>
        <p class="text-xs text-amber-600" v-else-if="isExistingStore">
          Existing store detected — will be added as-is without
          re-initialization.
        </p>
        <p class="text-muted-foreground text-xs" v-else>
          The directory will be created if it doesn't exist.
        </p>
      </div>

      <!-- Step: GPG Key (create) / Confirm (existing store) -->
      <div class="flex flex-col gap-3" v-else-if="step === 'gpg'">
        <p class="text-destructive text-xs" v-if="creationError">
          {{ creationError?.message }}
        </p>
        <template v-if="isExistingStore">
          <Label>Confirm</Label>
          <p class="text-muted-foreground text-sm">
            Existing store detected at
            <code class="font-mono">{{ storePath }}</code>
            — it will be added as-is without re-initialization. No key selection
            needed.
          </p>
        </template>
        <template v-else>
          <Label>Encryption Key</Label>
          <div class="flex items-center gap-2 py-4" v-if="isLoadingKeys">
            <Loader2 class="size-4 animate-spin" />
            <span class="text-muted-foreground text-sm"
              >Loading GPG keys...</span
            >
          </div>
          <div class="text-destructive py-4 text-sm" v-else-if="keysLoadError">
            Failed to load GPG keys: {{ keysLoadError }}
          </div>
          <div
            class="text-muted-foreground py-4 text-sm"
            v-else-if="secretKeys.length === 0"
          >
            No GPG secret keys found. Create one with
            <code class="font-mono">gpg --gen-key</code>
            first.
          </div>
          <Select v-else v-model="selectedKeyId">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select a GPG key" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="key in secretKeys"
                  :key="key.keyId"
                  :value="key.keyId"
                >
                  {{ keyLabel(key) }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p class="text-muted-foreground text-xs">
            This key will encrypt all passwords in the new store.
          </p>
        </template>
      </div>

      <!-- Step: Creating -->
      <div
        class="flex flex-col items-center gap-3 py-6"
        v-else-if="step === 'creating'"
      >
        <Loader2 class="text-muted-foreground size-8 animate-spin" />
        <span class="text-muted-foreground text-sm">{{
          isExistingStore ? "Adding store..." : "Creating store..."
        }}</span>
        <p class="text-destructive text-xs" v-if="creationError">
          {{ creationError?.message }}
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          v-if="step !== 'creating'"
          @click="step === 'name' ? emit('update:open', false) : goBack()"
        >
          {{ step === "name" ? "Cancel" : "Back" }}
        </Button>
        <Button
          v-if="step === 'name' || step === 'path'"
          :disabled="step === 'name' ? !canAdvanceName : !canAdvancePath"
          @click="advanceStep"
        >
          Next
        </Button>
        <Button
          v-else-if="step === 'gpg'"
          :disabled="!canCreate"
          @click="createStore"
        >
          {{ isExistingStore ? "Add Store" : "Create Store" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
