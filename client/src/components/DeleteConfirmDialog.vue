<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNotifyResult } from "@/composables/use-notify-result";
import { useEntryTreeStore } from "@/stores/entry-tree";

const props = defineProps<{
  entryPath: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const treeStore = useEntryTreeStore();
const isDeleting = ref(false);

async function handleDelete(): Promise<void> {
  isDeleting.value = true;
  const result = useNotifyResult(
    await treeStore.removeEntry(props.entryPath),
    { ok: false }
  );
  isDeleting.value = false;
  if (result.isOk()) {
    emit("update:open", false);
  }
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogTrigger v-if="!open" as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Entry</AlertDialogTitle>
        <AlertDialogDescription>
          Delete <code class="font-mono">{{ entryPath }}</code>?
          This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <!-- Plain Button, not AlertDialogAction: reka-ui's action closes the
             dialog via its own click handler before the awaited Result
             resolves, so a failed delete would look like success. -->
        <Button
          :disabled="isDeleting"
          variant="destructive"
          @click="handleDelete"
        >
          {{ isDeleting ? "Deleting..." : "Delete" }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
