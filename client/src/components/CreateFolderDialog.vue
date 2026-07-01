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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEntriesStore } from "@/stores/entries";

const props = defineProps<{
  parentPath?: string;
}>();

const entries = useEntriesStore();

const isOpen = ref(false);
const folderName = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

watch(isOpen, (open) => {
  if (open) {
    folderName.value = "";
    formError.value = null;
  }
});

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

  const result = await entries.createFolder(buildFullPath());

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
          <Button type="button" variant="outline" @click="isOpen = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            <FolderPlus class="size-4 mr-1" />
            {{ isSubmitting ? "Creating..." : "Create" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
