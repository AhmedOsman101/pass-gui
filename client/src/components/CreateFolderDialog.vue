<script setup lang="ts">
import { ref, watch } from "vue";
import { FolderPlus } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEntryTreeStore } from "@/stores/entry-tree";

const props = defineProps<{
  parentPath?: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const treeStore = useEntryTreeStore();

const folderName = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (open) {
      folderName.value = "";
      formError.value = null;
    }
  }
);

function buildFullPath(): string {
  if (props.parentPath) {
    return `${props.parentPath}/${folderName.value}`;
  }
  return folderName.value;
}

async function handleSubmit(): Promise<void> {
  const name = folderName.value.trim();
  if (!name) {
    formError.value = "Folder name is required";
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  const result = await treeStore.createFolder(buildFullPath());

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  emit("update:open", false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Create Folder</DialogTitle>
        <DialogDescription>
          New folder{{ parentPath ? ` in ${parentPath}` : "" }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <input
          v-model="folderName"
          type="text"
          placeholder="Folder name"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          autofocus
        />

        <p v-if="formError" class="text-sm text-destructive">
          {{ formError }}
        </p>

        <DialogFooter>
          <Button type="submit" :disabled="isSubmitting">
            <FolderPlus class="size-4 mr-1" />
            {{ isSubmitting ? "Creating..." : "Create" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
