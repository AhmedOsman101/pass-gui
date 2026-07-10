<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { toast } from "sonner";
import { FolderOpen, ChevronRight, ChevronLeft, Check, Loader2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog as NeuDialog } from "@/services/dialog";
import { Gpg } from "@/services/gpg";
import { Pass } from "@/services/pass";
import { Config } from "@/services/config";
import { Fs } from "@/services/filesystem";
import type { StoreConfig } from "@/types/config";
import type { SecretKey } from "@/types";

const props = defineProps<{
  stores: Record<string, StoreConfig>;
  activeStore: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

// Wizard state
type WizardStep = "name" | "path" | "gpg" | "creating";
const step = ref<WizardStep>("name");
const storeName = ref("");
const storePath = ref("");
const selectedKeyId = ref("");
const secretKeys = ref<SecretKey[]>([]);
const isLoadingKeys = ref(true);
const isCreating = ref(false);
const creationError = ref("");

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
  const existing = Object.values(props.stores).find((s) => s.path === path);
  if (existing) return "A store with this path already exists";
  return "";
});

const canAdvanceName = computed(
  () => storeName.value.trim() !== "" && !nameError.value,
);
const canAdvancePath = computed(
  () => storePath.value.trim() !== "" && !pathError.value,
);
const canCreate = computed(
  () => selectedKeyId.value !== "" && !isCreating.value,
);

// Load GPG keys on open
onMounted(async () => {
  if (!props.open) return;
  await loadKeys();
});

async function loadKeys(): Promise<void> {
  isLoadingKeys.value = true;
  const result = await Gpg.listSecretKeys();
  if (result.isOk()) {
    secretKeys.value = result.ok;
  } else {
    toast.error("Failed to load GPG keys");
  }
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
  }
}

function advanceStep(): void {
  switch (step.value) {
    case "name":
      if (canAdvanceName.value) step.value = "path";
      break;
    case "path":
      if (canAdvancePath.value) step.value = "gpg";
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
  isCreating.value = true;
  creationError.value = "";

  const name = storeName.value.trim();
  const path = storePath.value.trim();
  const gpgKeyId = selectedKeyId.value;

  // 1. Create directory (Fs.mkdir uses std::filesystem::create_directories — recursive)
  const mkdirResult = await Fs.mkdir(path);
  if (mkdirResult.isError()) {
    creationError.value = `Failed to create directory: ${mkdirResult.error.message}`;
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  // 2. Run pass init with scoped PASSWORD_STORE_DIR
  Pass.setStorePath(path);
  const initResult = await Pass.exec(["init", gpgKeyId]);
  if (initResult.isError()) {
    creationError.value = `pass init failed: ${initResult.error.message}`;
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  // 3. Restore previous store path
  const previousPath = props.stores[props.activeStore]?.path;
  if (previousPath) {
    Pass.setStorePath(previousPath);
  }

  // 4. Update config
  const configResult = await Config.load();
  if (configResult.isError()) {
    creationError.value = "Failed to load config for update";
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  const newStores = { ...configResult.ok.data.stores, [name]: { path } };
  const raw = configResult.ok._raw as Record<string, unknown>;
  (raw.stores as Record<string, unknown>) = newStores;
  const saveResult = await Config.save(configResult.ok);
  if (saveResult.isError()) {
    creationError.value = "Failed to save config";
    isCreating.value = false;
    step.value = "gpg";
    return;
  }

  // 5. Reset and close
  isCreating.value = false;
  toast.success(`Store "${name}" created`);
  emit("created");
  emit("update:open", false);
  resetWizard();
}

function resetWizard(): void {
  step.value = "name";
  storeName.value = "";
  storePath.value = "";
  selectedKeyId.value = "";
  creationError.value = "";
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
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge :variant="step === 'name' ? 'default' : 'outline'">1. Name</Badge>
        <ChevronRight class="size-3" />
        <Badge :variant="step === 'path' ? 'default' : 'outline'">2. Path</Badge>
        <ChevronRight class="size-3" />
        <Badge :variant="step === 'gpg' || step === 'creating' ? 'default' : 'outline'">3. GPG Key</Badge>
      </div>

      <Separator />

      <!-- Step: Name -->
      <div v-if="step === 'name'" class="flex flex-col gap-3">
        <Label for="store-name">Store Name</Label>
        <Input
          id="store-name"
          v-model="storeName"
          placeholder="my-store"
          autofocus
          @keydown.enter="advanceStep"
        />
        <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        <p v-else class="text-xs text-muted-foreground">
          A unique identifier for this store (letters, numbers, hyphens, underscores).
        </p>
      </div>

      <!-- Step: Path -->
      <div v-else-if="step === 'path'" class="flex flex-col gap-3">
        <Label for="store-path">Store Directory</Label>
        <div class="flex gap-2">
          <Input
            id="store-path"
            v-model="storePath"
            placeholder="/home/user/.password-store"
            class="flex-1 font-mono"
            autofocus
            @keydown.enter="advanceStep"
          />
          <Button
            variant="outline"
            size="icon"
            class="size-9 shrink-0"
            @click="pickFolder"
          >
            <FolderOpen class="size-4" />
          </Button>
        </div>
        <p v-if="pathError" class="text-xs text-destructive">{{ pathError }}</p>
        <p v-else class="text-xs text-muted-foreground">
          The directory will be created if it doesn't exist.
        </p>
      </div>

      <!-- Step: GPG Key -->
      <div v-else-if="step === 'gpg'" class="flex flex-col gap-3">
        <Label>Encryption Key</Label>
        <div v-if="isLoadingKeys" class="flex items-center gap-2 py-4">
          <Loader2 class="size-4 animate-spin" />
          <span class="text-sm text-muted-foreground">Loading GPG keys...</span>
        </div>
        <div v-else-if="secretKeys.length === 0" class="py-4 text-sm text-muted-foreground">
          No GPG secret keys found. Create one with
          <code class="font-mono">gpg --gen-key</code> first.
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
        <p class="text-xs text-muted-foreground">
          This key will encrypt all passwords in the new store.
        </p>
      </div>

      <!-- Step: Creating -->
      <div v-else-if="step === 'creating'" class="flex flex-col items-center gap-3 py-6">
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
        <span class="text-sm text-muted-foreground">Creating store...</span>
        <p v-if="creationError" class="text-xs text-destructive">{{ creationError }}</p>
      </div>

      <DialogFooter>
        <Button
          v-if="step !== 'creating'"
          variant="outline"
          @click="step === 'name' ? emit('update:open', false) : goBack()"
        >
          {{ step === 'name' ? 'Cancel' : 'Back' }}
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
          Create Store
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
