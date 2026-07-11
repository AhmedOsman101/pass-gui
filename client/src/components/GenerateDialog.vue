<script setup lang="ts">
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
import { usePasswordGenerator } from "@/composables/use-password-generator";
import GeneratorOptionsPanel from "@/components/GeneratorOptionsPanel.vue";
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    presetPassword?: string;
    open?: boolean;
  }>(),
  {
    open: false,
  },
);

const emit = defineEmits<{
  (e: "saved"): void;
  (e: "update:open", value: boolean): void;
}>();

const treeStore = useEntryTreeStore();
const activeStore = useActiveStoreStore();
const genOptions = usePasswordGenerator();

const internalOpen = ref(false);
const isOpen = computed({
  get: () => props.open ?? internalOpen.value,
  set: (v: boolean) => {
    internalOpen.value = v;
    emit("update:open", v);
  },
});
const path = ref("");
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

watch(() => props.presetPassword, (val) => {
  if (val) genOptions.generated = val;
}, { immediate: true });

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

  const password = props.presetPassword || genOptions.generated;
  const result = await treeStore.insertEntry(path.value, password);

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  isOpen.value = false;
  path.value = "";
  emit("saved");
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Generate Password</DialogTitle>
        <DialogDescription>
          Generate a random password and save it to the store.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <GeneratorOptionsPanel
          v-model:gen-state="genOptions"
          @regenerate="genOptions.regenerate"
        />

        <div class="space-y-2">
          <label for="gen-path" class="text-sm font-medium"> Path </label>
          <input
            id="gen-path"
            v-model="path"
            type="text"
            placeholder="Email/work"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        <p v-if="formError" class="text-sm text-destructive">
          {{ formError }}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" @click="isOpen = false">
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
