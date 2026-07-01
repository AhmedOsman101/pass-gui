<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Folder, FolderOpen, FolderPlus } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEntriesStore } from "@/stores/entries";
import type { EntryNode } from "@/types/entries";

const props = defineProps<{
  currentPath: string;
}>();

const entries = useEntriesStore();

const isOpen = ref(false);
const newPath = ref("");
const selectedFolder = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

// New folder creation
const newFolderName = ref("");
const isCreatingFolder = ref(false);
const folderError = ref<string | null>(null);

const currentName = computed(() => {
  const parts = props.currentPath.split("/");
  return parts[parts.length - 1] ?? "";
});

const directories = computed(() => {
  const dirs: { name: string; path: string }[] = [{ name: "(root)", path: "" }];

  function collectDirs(nodes: EntryNode[], prefix: string): void {
    for (const node of nodes) {
      if (node.type === "DIRECTORY") {
        const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
        dirs.push({ name: node.name, path: fullPath });
        if (node.children) collectDirs(node.children, fullPath);
      }
    }
  }

  collectDirs(entries.tree, "");
  return dirs;
});

function buildFullDestination(): string {
  if (selectedFolder.value) {
    return `${selectedFolder.value}/${newPath.value}`;
  }
  return newPath.value;
}

watch(isOpen, (open) => {
  if (open) {
    const parts = props.currentPath.split("/");
    const name = parts.pop() ?? "";
    selectedFolder.value = parts.join("/");
    newPath.value = name;
    formError.value = null;
    newFolderName.value = "";
    folderError.value = null;
  }
});

async function createNewFolder(): Promise<void> {
  const name = newFolderName.value.trim();
  if (!name) {
    folderError.value = "Folder name is required";
    return;
  }

  const parentPath = selectedFolder.value;
  const fullPath = parentPath ? `${parentPath}/${name}` : name;

  isCreatingFolder.value = true;
  folderError.value = null;

  const result = await entries.createFolder(fullPath);

  isCreatingFolder.value = false;

  if (result) {
    folderError.value = result;
    return;
  }

  selectedFolder.value = fullPath;
  newFolderName.value = "";
}

async function handleSubmit(): Promise<void> {
  const dest = newPath.value.trim();
  if (!dest) {
    formError.value = "Name is required";
    return;
  }

  const fullPath = buildFullDestination();
  if (fullPath === props.currentPath) {
    formError.value = "Destination is the same as current path";
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  const result = await entries.duplicateEntry(props.currentPath, fullPath);

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  isOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Duplicate Entry</DialogTitle>
        <DialogDescription>
          Copy <code class="font-mono">{{ currentPath }}</code> to a new location
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label class="text-sm font-medium">Destination folder</label>
          <div class="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-0.5">
            <button
              v-for="dir in directories"
              :key="dir.path"
              type="button"
              class="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm text-left transition-colors"
              :class="selectedFolder === dir.path
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'"
              @click="selectedFolder = dir.path"
            >
              <FolderOpen v-if="selectedFolder === dir.path" class="size-4 shrink-0" />
              <Folder v-else class="size-4 shrink-0" />
              <span class="truncate">{{ dir.name }}</span>
            </button>
          </div>
        </div>

        <!-- Create new folder -->
        <div class="flex items-center gap-2">
          <input
            v-model="newFolderName"
            type="text"
            placeholder="New folder name"
            class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            @keydown.enter.prevent="createNewFolder"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="shrink-0"
            :disabled="isCreatingFolder || !newFolderName.trim()"
            @click="createNewFolder"
          >
            <FolderPlus class="size-4 mr-1" />
            {{ isCreatingFolder ? "Creating..." : "New" }}
          </Button>
        </div>
        <p v-if="folderError" class="text-xs text-destructive">
          {{ folderError }}
        </p>

        <div class="space-y-2">
          <label for="dup-name" class="text-sm font-medium">New name</label>
          <input
            id="dup-name"
            v-model="newPath"
            type="text"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            :placeholder="currentName"
          />
        </div>

        <div class="text-xs text-muted-foreground">
          Destination: <code class="font-mono">{{ buildFullDestination() || "..." }}</code>
        </div>

        <p v-if="formError" class="text-sm text-destructive">
          {{ formError }}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="isOpen = false"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Copying..." : "Duplicate" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
