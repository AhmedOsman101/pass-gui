<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useActiveStoreStore } from "@/stores/active-store";
import { useReadinessStore } from "@/stores/readiness";
import BlockedScreen from "./BlockedScreen.vue";
import LoadingScreen from "./LoadingScreen.vue";

const readiness = useReadinessStore();
const activeStore = useActiveStoreStore();

/**
 * On mount: load the active store config, then evaluate readiness.
 * If readiness fails or is blocked, show the appropriate screen.
 * If ready, render the slot content (main app layout).
 */
onMounted(async () => {
  await activeStore.load();

  const storePath = activeStore.storePath;
  if (storePath) {
    await readiness.evaluate(storePath);
  }
});

/**
 * When the active store switches, re-evaluate readiness.
 */
watch(
  () => activeStore.storePath,
  async (newPath) => {
    if (newPath) {
      await readiness.evaluate(newPath);
    }
  }
);
</script>

<template>
  <LoadingScreen v-if="activeStore.isValidating || readiness.isEvaluating" />
  <BlockedScreen
    v-else-if="!readiness.isReady || !activeStore.hasStore"
  />
  <slot v-else />
</template>
