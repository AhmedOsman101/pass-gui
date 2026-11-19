<script lang="ts" setup>
import { FolderOpen, Pencil, Plus, Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";
import StoreDeleteDialog from "@/components/StoreDeleteDialog.vue";
import AddStoreWizard from "@/components/settings/AddStoreWizard.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Dialog } from "@/services/dialog";
import type { AppConfig, StoreConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const activeStoreModel = defineModel<string>("activeStore", { required: true });

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

const deleteDialogOpen = ref(false);
const deleteTarget = ref<{ name: string; path: string } | null>(null);
const wizardOpen = ref(false);
const editingStore = ref<string | null>(null);
const editStoreForm = ref({ path: "", gnupgHome: "" });
const editError = ref<string | null>(null);

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
  editError.value = null;
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
  if (!path) {
    editError.value = "Path is required";
    return;
  }
  if (!isPathUnique(path, editingStore.value)) {
    editError.value = "A store with this path already exists";
    return;
  }
  editError.value = null;
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
          <SelectTrigger class="w-full" id="active-store">
            <SelectValue placeholder="Select a store">
              <template #default>
                <span
                  class="flex w-full items-center"
                  v-if="activeStoreModel && stores[activeStoreModel]"
                >
                  <span>{{ activeStoreModel }}</span>
                  <span class="text-muted-foreground ml-auto pl-4 text-xs">{{
                    stores[activeStoreModel]?.path
                  }}</span>
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
                  <span class="text-muted-foreground ml-auto pl-4 text-xs">{{
                    store.path
                  }}</span>
                </span>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-muted-foreground text-xs">
          Which password store is currently active.
        </p>
      </div>

      <Separator />

      <div
        class="flex flex-col gap-2 rounded-lg border p-4"
        v-for="store in storeEntries"
        :key="store.name"
      >
        <div
          class="flex items-center justify-between"
          v-if="editingStore !== store.name"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ store.name }}</span>
              <Badge
                class="text-xs"
                variant="secondary"
                v-if="store.name === activeStore"
              >
                active
              </Badge>
            </div>
            <span class="text-muted-foreground font-mono text-xs">
              {{ store.path }}
            </span>
            <span
              class="text-muted-foreground font-mono text-xs"
              v-if="store.gnupg_home"
            >
              GNUPGHOME: {{ store.gnupg_home }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Button
              class="size-8"
              size="icon"
              variant="ghost"
              @click="startEditStore(store.name)"
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              class="text-destructive size-8"
              size="icon"
              variant="ghost"
              v-if="store.name !== activeStore"
              @click="promptDeleteStore(store.name)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
        <div class="flex flex-col gap-4" v-else>
          <div class="flex flex-col gap-2">
            <Label>Path</Label>
            <div class="flex gap-2">
              <Input class="flex-1 font-mono" v-model="editStoreForm.path" />
              <Button
                class="size-9 shrink-0"
                size="icon"
                variant="outline"
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
                class="flex-1 font-mono"
                placeholder="Default GPG home"
                v-model="editStoreForm.gnupgHome"
              />
              <Button
                class="size-9 shrink-0"
                size="icon"
                variant="outline"
                @click="pickFolder('edit-gnupg')"
              >
                <FolderOpen class="size-4" />
              </Button>
            </div>
          </div>
          <p class="text-destructive text-xs" v-if="editError">
            {{ editError }}
          </p>
          <div class="flex justify-end gap-2">
            <Button size="sm" variant="outline" @click="editingStore = null">
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
          <Plus class="mr-1 size-4" />
          Add Store
        </Button>
        <Button :disabled="isSaving" @click="emit('saveActiveStore')">
          Save
        </Button>
      </div>

      <StoreDeleteDialog
        v-if="deleteTarget"
        v-model:open="deleteDialogOpen"
        :store-name="deleteTarget.name"
        :store-path="deleteTarget.path"
        @deleted="confirmDeleteStore"
      />
      <AddStoreWizard
        v-model:open="wizardOpen"
        :active-store="activeStore"
        :stores="stores"
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
