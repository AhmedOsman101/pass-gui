<script setup lang="ts">
import { ref, watch } from "vue";
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

const props = defineProps<{
  currentPath: string;
  currentContent: string;
}>();

const treeStore = useEntryTreeStore();

const isOpen = ref(false);
const content = ref(props.currentContent);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

watch(isOpen, (open) => {
  if (open) {
    content.value = props.currentContent;
    formError.value = null;
  }
});

async function handleSubmit(): Promise<void> {
  if (!content.value.trim()) {
    formError.value = "Content cannot be empty";
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  const result = await treeStore.editEntry(props.currentPath, content.value);

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
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Edit Entry</DialogTitle>
        <DialogDescription>
          Editing <code class="font-mono">{{ currentPath }}</code>
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label for="entry-content" class="text-sm font-medium">
            Content
          </label>
          <textarea
            id="entry-content"
            v-model="content"
            rows="12"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            placeholder="Password on line 1, metadata as key: value on subsequent lines"
          />
          <p class="text-xs text-muted-foreground">
            Line 1 is the password. Subsequent lines use <code>key: value</code> format for metadata.
          </p>
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
            {{ isSubmitting ? "Saving..." : "Save" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
