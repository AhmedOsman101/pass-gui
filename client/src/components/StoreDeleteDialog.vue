<script setup lang="ts">
import { ref } from "vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const props = defineProps<{
  storeName: string;
  storePath: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  deleted: [storeName: string];
}>();

const isDeleting = ref(false);

function handleDelete(): void {
  isDeleting.value = true;
  emit("deleted", props.storeName);
  isDeleting.value = false;
  emit("update:open", false);
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogTrigger v-if="!open" as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Store</AlertDialogTitle>
        <AlertDialogDescription>
          Delete store <code class="font-mono">{{ storeName }}</code>
          at <code class="font-mono">{{ storePath }}</code>?
          This will remove it from the config but will NOT delete
          the directory on disk.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          :disabled="isDeleting"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="handleDelete"
        >
          {{ isDeleting ? "Deleting..." : "Delete" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
