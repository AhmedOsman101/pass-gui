<script lang="ts" setup>
import { FolderPlus } from "@lucide/vue";
import { ref, watch } from "vue";
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
  open => {
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
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Create Folder</DialogTitle>
        <DialogDescription>
          New folder{{ parentPath ? ` in ${parentPath}` : "" }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <input
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
          placeholder="Folder name"
          type="text"
          v-model="folderName"
        >

        <p class="text-destructive text-sm" v-if="formError">
          {{ formError }}
        </p>

        <DialogFooter>
          <Button type="submit" :disabled="isSubmitting">
            <FolderPlus class="mr-1 size-4" />
            {{ isSubmitting ? "Creating..." : "Create" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
