<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
import { useEntryTreeStore } from "@/stores/entry-tree";
import { Logger } from "@/lib/logger";
import { Fs } from "@/services/filesystem";

const props = defineProps<{
  currentPath: string;
  nodeType?: "FILE" | "DIRECTORY";
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const treeStore = useEntryTreeStore();

const newName = ref("");
const currentName = ref("");
const parentDir = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const isDirectory = computed(() => props.nodeType === "DIRECTORY");
const dialogTitle = computed(() =>
  isDirectory.value ? "Rename Folder" : "Rename Entry"
);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    formError.value = null;

    void (async () => {
      const parts = await Fs.getPathParts(props.currentPath);
      if (parts.isError()) {
        await Logger.error(
          `RenameEntryDialog: cannot split "${props.currentPath}": ${parts.error.message}`
        );
        return;
      }
      currentName.value = parts.ok.filename;
      parentDir.value = parts.ok.parentPath;
      newName.value = parts.ok.filename;
    })();
  },
  { immediate: true }
);

async function handleSubmit(): Promise<void> {
  const name = newName.value.trim();
  if (!name) {
    formError.value = "Name is required";
    return;
  }

  if (name === currentName.value) {
    formError.value = "Name is the same as current name";
    return;
  }

  const fullPath = parentDir.value ? `${parentDir.value}/${name}` : name;

  isSubmitting.value = true;
  formError.value = null;

  const result = await treeStore.moveEntry(
    props.currentPath,
    fullPath,
    props.nodeType
  );

  isSubmitting.value = false;

  result.match({
    okFn: () => {
      emit("update:open", false);
    },
    errFn: e => {
      formError.value = e.message;
    },
  });
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogTrigger v-if="!open" as-child>
      <slot />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>
          Rename <code class="font-mono">{{ currentPath }}</code>
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label for="new-name" class="text-sm font-medium">New name</label>
          <input
            id="new-name"
            v-model="newName"
            type="text"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            :placeholder="currentName"
          />
        </div>

        <p v-if="formError" class="text-sm text-destructive">
          {{ formError }}
        </p>

        <DialogFooter>
          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Renaming..." : "Rename" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
