<script lang="ts" setup>
import { Folder, FolderOpen, FolderPlus } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import DirectoryTree from "@/components/DirectoryTree.vue";
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
import { Logger } from "@/lib/logger";
import { Fs } from "@/services/filesystem";
import { useEntryTreeStore } from "@/stores/entry-tree";

const props = defineProps<{
  currentPath: string;
  mode: "move" | "duplicate";
}>();

const treeStore = useEntryTreeStore();

const isOpen = ref(false);
const newPath = ref("");
const selectedFolder = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

// New folder creation
const newFolderName = ref("");
const isCreatingFolder = ref(false);
const folderError = ref<string | null>(null);

const currentName = ref("");

const dialogTitle = computed(() => {
  return props.mode === "move" ? "Move Entry" : "Duplicate Entry";
});

const actionVerb = computed(() => {
  return props.mode === "move" ? "Move" : "Copy";
});

const submitLabel = computed(() => {
  return props.mode === "move" ? "Move" : "Duplicate";
});

const submittingLabel = computed(() => {
  return props.mode === "move" ? "Moving..." : "Copying...";
});

const inputId = computed(() => {
  return props.mode === "move" ? "new-name" : "dup-name";
});

function buildFullDestination(): string {
  if (selectedFolder.value) {
    return `${selectedFolder.value}/${newPath.value}`;
  }
  return newPath.value;
}

watch(isOpen, open => {
  if (!open) return;
  formError.value = null;
  newFolderName.value = "";
  folderError.value = null;

  void (async () => {
    const parts = await Fs.getPathParts(props.currentPath);
    if (parts.isError()) {
      // Leave fields empty — the user can type a destination manually.
      await Logger.error(
        `MoveOrDuplicateDialog: cannot split "${props.currentPath}": ${parts.error.message}`
      );
      return;
    }
    selectedFolder.value = parts.ok.parentPath;
    newPath.value = parts.ok.filename;
    currentName.value = parts.ok.filename;
  })();
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

  const result = await treeStore.createFolder(fullPath);

  isCreatingFolder.value = false;

  result.match({
    okFn: () => {
      selectedFolder.value = fullPath;
      newFolderName.value = "";
    },
    errFn: e => {
      folderError.value = e.message;
    },
  });
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

  const result =
    props.mode === "move"
      ? await treeStore.moveEntry(props.currentPath, fullPath)
      : await treeStore.duplicateEntry(props.currentPath, fullPath);

  isSubmitting.value = false;

  result.match({
    okFn: () => {
      isOpen.value = false;
    },
    errFn: e => {
      formError.value = e.message;
    },
  });
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>
          {{ actionVerb }} <code class="font-mono">{{ currentPath }}</code> to a
          new location
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Destination folder picker -->
        <div class="space-y-2">
          <div class="text-sm font-medium">Destination folder</div>
          <div
            class="bg-muted/30 max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-2"
          >
            <button
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors"
              type="button"
              :class="
                selectedFolder === ''
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              "
              @click="selectedFolder = ''"
            >
              <FolderOpen
                class="size-4 shrink-0"
                v-if="selectedFolder === ''"
              />
              <Folder class="size-4 shrink-0" v-else />
              <span class="truncate">(root)</span>
            </button>
            <DirectoryTree
              :nodes="treeStore.tree"
              :selected-path="selectedFolder"
              @select="(p: string) => (selectedFolder = p)"
            />
          </div>
        </div>

        <!-- Create new folder -->
        <div class="flex items-center gap-2">
          <input
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex-1 rounded-md border px-3 py-1.5 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
            placeholder="New folder name"
            type="text"
            v-model="newFolderName"
            @keydown.enter.prevent="createNewFolder"
          >
          <Button
            class="shrink-0"
            size="sm"
            type="button"
            variant="outline"
            :disabled="isCreatingFolder || !newFolderName.trim()"
            @click="createNewFolder"
          >
            <FolderPlus class="mr-1 size-4" />
            {{ isCreatingFolder ? "Creating..." : "New" }}
          </Button>
        </div>
        <p class="text-destructive text-xs" v-if="folderError">
          {{ folderError }}
        </p>

        <!-- New name -->
        <div class="space-y-2">
          <label class="text-sm font-medium" :for="inputId">New name</label>
          <input
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
            type="text"
            v-model="newPath"
            :id="inputId"
            :placeholder="currentName"
          >
        </div>

        <!-- Preview -->
        <div class="text-muted-foreground text-xs">
          Destination:
          <code class="font-mono">{{ buildFullDestination() || "..." }}</code>
        </div>

        <p class="text-destructive text-sm" v-if="formError">
          {{ formError }}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" @click="isOpen = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? submittingLabel : submitLabel }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
