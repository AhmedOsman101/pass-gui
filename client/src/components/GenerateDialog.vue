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
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntriesStore } from "@/stores/entries";

const entries = useEntriesStore();
const activeStore = useActiveStoreStore();

const isOpen = ref(false);
const path = ref("");
const memorable = ref(false);
const length = ref(25);
const symbols = ref(false);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

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

  const result = await entries.generateEntry(path.value, {
    memorable: memorable.value,
    length: length.value,
    symbols: symbols.value,
  });

  isSubmitting.value = false;

  if (result) {
    formError.value = result;
    return;
  }

  isOpen.value = false;
  path.value = "";
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
        <div class="space-y-2">
          <label for="gen-path" class="text-sm font-medium">
            Path
          </label>
          <input
            id="gen-path"
            v-model="path"
            type="text"
            placeholder="Email/work"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        <div class="flex items-center justify-between">
          <label for="gen-memorable" class="text-sm font-medium">
            Memorable
          </label>
          <button
            id="gen-memorable"
            type="button"
            role="switch"
            :aria-checked="memorable"
            class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            :class="memorable ? 'bg-primary' : 'bg-input'"
            @click="memorable = !memorable"
          >
            <span
              class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="memorable ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </div>

        <div v-if="!memorable" class="space-y-2">
          <div class="flex items-center justify-between">
            <label for="gen-length" class="text-sm font-medium">
              Length: {{ length }}
            </label>
            <span class="text-xs text-muted-foreground">{{ length }}</span>
          </div>
          <input
            id="gen-length"
            v-model.number="length"
            type="range"
            min="8"
            max="64"
            class="w-full"
          />
        </div>

        <div v-if="!memorable" class="flex items-center justify-between">
          <label for="gen-symbols" class="text-sm font-medium">
            Symbols
          </label>
          <button
            id="gen-symbols"
            type="button"
            role="switch"
            :aria-checked="symbols"
            class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            :class="symbols ? 'bg-primary' : 'bg-input'"
            @click="symbols = !symbols"
          >
            <span
              class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="symbols ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </div>

        <p v-if="memorable" class="text-xs text-muted-foreground">
          Format: NNNN-word-word-word (4 digits + 3 EFF words)
        </p>

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
            {{ isSubmitting ? "Generating…" : "Generate" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
