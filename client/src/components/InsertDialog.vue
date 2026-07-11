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
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntryTreeStore } from "@/stores/entry-tree";

const props = withDefaults(
  defineProps<{
    presetPassword?: string;
    open?: boolean;
  }>(),
  { presetPassword: undefined, open: false }
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const treeStore = useEntryTreeStore();
const activeStore = useActiveStoreStore();

const isOpen = ref(props.open);

watch(
  () => props.open,
  (val) => {
    isOpen.value = val;
  }
);

watch(isOpen, (val) => {
  emit("update:open", val);
});
const path = ref("");
const content = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

watch(
  () => props.presetPassword,
  (pw) => {
    if (pw !== undefined) {
      content.value = pw;
    }
  }
);

async function handleSubmit(): Promise<void> {
  if (!path.value.trim()) {
    formError.value = "Path is required";
    return;
  }

  if (!activeStore.hasStore) {
    formError.value = "No active store";
    return;
  }

  isSubmitting.value = true;
  formError.value = null;

  const result = await treeStore.insertEntry(path.value, content.value);

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  isOpen.value = false;
  path.value = "";
  content.value = "";
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New Entry</DialogTitle>
        <DialogDescription>
          Create a new password entry in the store.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label for="entry-path" class="text-sm font-medium">
            Path
          </label>
          <input
            id="entry-path"
            v-model="path"
            type="text"
            placeholder="Email/work"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <p class="text-xs text-muted-foreground">
            Store-relative path, e.g. <code>Email/work</code>
          </p>
        </div>

        <div class="space-y-2">
          <label for="entry-content" class="text-sm font-medium">
            Password
          </label>
          <textarea
            id="entry-content"
            v-model="content"
            rows="3"
            placeholder="Paste or type password content"
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
            {{ isSubmitting ? "Creating..." : "Create" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
