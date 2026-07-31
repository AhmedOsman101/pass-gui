<script setup lang="ts">
import { Trash2, Pencil, FolderOpen, Plus } from "@lucide/vue";
import { computed, ref } from "vue";
import StoreDeleteDialog from "@/components/StoreDeleteDialog.vue";
import AddStoreWizard from "@/components/settings/AddStoreWizard.vue";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog } from "@/services/dialog";
import type { AppConfig, StoreConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const props = defineProps<{
  config: ParsedToml<AppConfig>;
  stores: Record<string, StoreConfig>;
  activeStore: string;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  saveStore: [name: string, data: StoreConfig];
  deleteStore: [name: string];
  saveActiveStore: [];
  updateActiveStore: [store: string];
  updateStores: [stores: Record<string, StoreConfig>];
}>();

const activeStoreModel = defineModel<string>("activeStore", { required: true });

const deleteDialogOpen = ref(false);
const deleteTarget = ref<{ name: string; path: string } | null>(null);
const wizardOpen = ref(false);
const editingStore = ref<string | null>(null);
const editStoreForm = ref({ path: "", gnupgHome: "" });

const storeEntries = computed(() => {
  const entries = Object.entries(props.stores).map(([name, data]) => ({
    name,
    ...data,
  }));
  // Sort: active store first, then alphabetically by name
  return entries.sort((a, b) => {
    if (a.name === props.activeStore) return -1;
    if (b.name === props.activeStore) return 1;
    return a.name.localeCompare(b.name);
  });
});

function startEditStore(name: string): void {
  editingStore.value = name;
  editStoreForm.value = {
    path: props.stores[name]?.path ?? "",
    gnupgHome: props.stores[name]?.gnupg_home ?? "",
  };
}

function findStoreByPath(path: string): string | undefined {
  return Object.entries(props.stores).find(
    ([name, store]) => store.path === path
  )?.[0];
}

function isPathUnique(path: string, excludeName?: string): boolean {
  const existing = findStoreByPath(path);
  return !existing || existing === excludeName;
}

function saveEditStore(): void {
  if (!editingStore.value) return;
  const path = editStoreForm.value.path.trim();
  if (!path) return;
  if (!isPathUnique(path, editingStore.value)) {
    return;
  }
  const storeData: StoreConfig = {
    path,
    gnupg_home: editStoreForm.value.gnupgHome || undefined,
  };
  const updated = { ...props.stores, [editingStore.value]: storeData };
  emit("updateStores", updated);
  emit("saveStore", editingStore.value, storeData);
  editingStore.value = null;
}

function promptDeleteStore(name: string): void {
  const store = props.stores[name];
  if (!store) return;
  deleteTarget.value = { name, path: store.path };
  deleteDialogOpen.value = true;
}

function confirmDeleteStore(name: string): void {
  const updated = { ...props.stores };
  delete updated[name];
  emit("updateStores", updated);
  emit("deleteStore", name);
}

function handleStoreCreated(store: { name: string; path: string }): void {
  const updated = { ...props.stores, [store.name]: { path: store.path } };
  emit("updateStores", updated);
}

async function pickFolder(target: "edit-path" | "edit-gnupg"): Promise<void> {
  const result = await Dialog.showFolderDialog("Select directory");
  if (result.isOk() && result.ok) {
    if (target === "edit-path") {
      editStoreForm.value.path = result.ok;
    } else {
      editStoreForm.value.gnupgHome = result.ok;
    }
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Password Stores</CardTitle>
      <CardDescription>Manage configured password stores.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="active-store">Active Store</Label>
        <Select v-model="activeStoreModel">
          <SelectTrigger id="active-store" class="w-full">
            <SelectValue placeholder="Select a store">
              <template #default>
                <span v-if="activeStoreModel && stores[activeStoreModel]" class="flex w-full items-center">
                  <span>{{ activeStoreModel }}</span>
                  <span class="ml-auto pl-4 text-xs text-muted-foreground">{{ stores[activeStoreModel]?.path }}</span>
                </span>
                <span v-else>Select a store</span>
              </template>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="(store, name) in stores"
                :key="name"
                :value="name"
              >
                <span class="flex w-full items-center">
                  <span>{{ name }}</span>
                  <span class="ml-auto pl-4 text-xs text-muted-foreground">{{ store.path }}</span>
                </span>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          Which password store is currently active.
        </p>
      </div>

      <Separator />

      <div
        v-for="store in storeEntries"
        :key="store.name"
        class="flex flex-col gap-2 rounded-lg border p-4"
      >
        <div
          v-if="editingStore !== store.name"
          class="flex items-center justify-between"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ store.name }}</span>
              <Badge
                v-if="store.name === activeStore"
                variant="secondary"
                class="text-xs"
              >
                active
              </Badge>
            </div>
            <span class="font-mono text-xs text-muted-foreground">
              {{ store.path }}
            </span>
            <span
              v-if="store.gnupg_home"
              class="font-mono text-xs text-muted-foreground"
            >
              GNUPGHOME: {{ store.gnupg_home }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              @click="startEditStore(store.name)"
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              v-if="store.name !== activeStore"
              variant="ghost"
              size="icon"
              class="size-8 text-destructive"
              @click="promptDeleteStore(store.name)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
        <div v-else class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <Label>Path</Label>
            <div class="flex gap-2">
              <Input v-model="editStoreForm.path" class="flex-1 font-mono" />
              <Button
                variant="outline"
                size="icon"
                class="size-9 shrink-0"
                @click="pickFolder('edit-path')"
              >
                <FolderOpen class="size-4" />
              </Button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label>
              GNUPGHOME
              <span class="text-muted-foreground">(optional)</span>
            </Label>
            <div class="flex gap-2">
              <Input
                v-model="editStoreForm.gnupgHome"
                class="flex-1 font-mono"
                placeholder="Default GPG home"
              />
              <Button
                variant="outline"
                size="icon"
                class="size-9 shrink-0"
                @click="pickFolder('edit-gnupg')"
              >
                <FolderOpen class="size-4" />
              </Button>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" size="sm" @click="editingStore = null">
              Cancel
            </Button>
            <Button size="sm" :disabled="isSaving" @click="saveEditStore">
              Save
            </Button>
          </div>
        </div>
      </div>

      <Separator />
      <div class="flex justify-end gap-2">
        <Button @click="wizardOpen = true">
          <Plus class="size-4 mr-1" />
          Add Store
        </Button>
        <Button :disabled="isSaving" @click="emit('saveActiveStore')">
          Save
        </Button>
      </div>

      <StoreDeleteDialog
        v-if="deleteTarget"
        :store-name="deleteTarget.name"
        :store-path="deleteTarget.path"
        v-model:open="deleteDialogOpen"
        @deleted="confirmDeleteStore"
      />
      <AddStoreWizard
        :stores="stores"
        :active-store="activeStore"
        v-model:open="wizardOpen"
        @created="handleStoreCreated"
      />
    </CardContent>
  </Card>
</template>

<style scoped>
:deep([data-slot="select-item"] > span:last-child) {
  display: block;
  width: 100%;
}
:deep([data-slot="select-value"]) {
  display: flex;
  width: 100%;
}
</style>
