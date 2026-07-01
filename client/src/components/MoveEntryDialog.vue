<script setup lang="ts">
import { ref } from "vue";
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
  currentPath: string;
}>();

const entries = useEntriesStore();

const isOpen = ref(false);
const newPath = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

async function handleSubmit(): Promise<void> {
  if (!newPath.value.trim()) {
    formError.value = "New path is required";
    return;
  }

  if (newPath.value === props.currentPath) {
    formError.value = "New path is the same as the current path";
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  const result = await entries.moveEntry(props.currentPath, newPath.value);

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  isOpen.value = false;
  newPath.value = "";
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Move Entry</DialogTitle>
        <DialogDescription>
          Rename or move <code class="font-mono">{{ currentPath }}</code>
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label for="new-path" class="text-sm font-medium">
            New path
          </label>
          <input
            id="new-path"
            v-model="newPath"
            type="text"
            :placeholder="currentPath"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
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
            {{ isSubmitting ? "Moving…" : "Move" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
