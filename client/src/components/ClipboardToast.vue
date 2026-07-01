<script setup lang="ts">
import { computed } from "vue";
import { useClipboardStore } from "@/stores/clipboard";

const clipboard = useClipboardStore();

const entryPath = computed(() => clipboard.lastAction?.path ?? "");
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="clipboard.isActive"
        class="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background shadow-lg px-4 py-3"
      >
        <div class="text-sm">
          <span class="font-medium">Password copied.</span>
          <span class="text-muted-foreground">
            Clears in {{ clipboard.formattedRemaining }}
          </span>
          <span v-if="entryPath" class="text-muted-foreground">
            · {{ entryPath }}
          </span>
        </div>
        <button
          class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          @click="clipboard.clear()"
        >
          Clear now
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
