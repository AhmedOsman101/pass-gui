<script setup lang="ts">
import { watch } from "vue";
import { ref } from "vue";
import { useEntriesStore } from "@/stores/entries";

const entries = useEntriesStore();
const visible = ref(false);

watch(
  () => entries.error,
  (msg) => {
    if (msg) {
      visible.value = true;
      setTimeout(() => {
        visible.value = false;
        entries.error = null;
      }, 4000);
    }
  },
);
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
        v-if="visible && entries.error"
        class="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-destructive/50 bg-background shadow-lg px-4 py-3"
      >
        <div class="text-sm text-destructive">
          {{ entries.error }}
        </div>
        <button
          class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          @click="visible = false; entries.error = null"
        >
          Dismiss
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
