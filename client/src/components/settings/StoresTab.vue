<script setup lang="ts">
import { Plus, Trash2, Pencil, FolderOpen } from "@lucide/vue";
import { computed, ref } from "vue";
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
  save: [];
  saveActiveStore: [];
  updateActiveStore: [store: string];
  updateStores: [stores: Record<string, StoreConfig>];
}>();

const activeStoreModel = defineModel<string>("activeStore", { required: true });

const newStoreName = ref("");
const newStorePath = ref("");
const editingStore = ref<string | null>(null);
const editStoreForm = ref({ path: "", gnupgHome: "" });

const storeEntries = computed(() =>
  Object.entries(props.stores).map(([name, data]) => ({
    name,
    ...data,
  })),
);

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
  editingStore.value = null;
  emit("save");
}

function deleteStore(name: string): void {
  if (name === "default") return;
  if (name === props.activeStore) return;
  const updated = { ...props.stores };
  delete updated[name];
  emit("updateStores", updated);
  emit("save");
}

function addStore(): void {
  const name = newStoreName.value.trim();
  const path = newStorePath.value.trim();
  if (!name || !path) return;
  if (props.stores[name]) return;
  if (!isPathUnique(path)) return;
  const updated = { ...props.stores, [name]: { path } };
  emit("updateStores", updated);
  newStoreName.value = "";
  newStorePath.value = "";
  emit("save");
}

async function pickFolder(target: "new-path" | "edit-path" | "edit-gnupg"): Promise<void> {
  const result = await Dialog.showFolderDialog("Select directory");
  if (result.isOk() && result.ok) {
    if (target === "new-path") {
      newStorePath.value = result.ok;
    } else if (target === "edit-path") {
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
              v-if="store.name !== 'default' && store.name !== activeStore"
              variant="ghost"
              size="icon"
              class="size-8 text-destructive"
              @click="deleteStore(store.name)"
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

      <div class="flex flex-col gap-3">
        <Label>Add New Store</Label>
        <div class="flex gap-2">
          <Input
            v-model="newStoreName"
            placeholder="Store name"
            class="flex-1"
          />
          <div class="flex flex-1 gap-2">
            <Input
              v-model="newStorePath"
              placeholder="~/.password-store"
              class="flex-1 font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              class="size-9 shrink-0"
              @click="pickFolder('new-path')"
            >
              <FolderOpen class="size-4" />
            </Button>
          </div>
          <Button
            :disabled="isSaving || !newStoreName.trim() || !newStorePath.trim()"
            @click="addStore"
          >
            <Plus class="size-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('saveActiveStore')">
          Save
        </Button>
      </div>
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
