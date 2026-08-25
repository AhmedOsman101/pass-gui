<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useActiveStoreStore } from "@/stores/active-store";
import { useReadinessStore } from "@/stores/readiness";
import { Gpg } from "@/services/gpg";
import { Neu } from "@/services/neutralino";
import { Pass } from "@/services/pass";
import BlockedScreen from "./BlockedScreen.vue";
import LoadingScreen from "./LoadingScreen.vue";

const readiness = useReadinessStore();
const activeStore = useActiveStoreStore();

// Distinct critical error: Neu (HOME_DIR) is core API — if it fails the
// entire app is paralyzed, not a normal readiness issue. Gate shows a
// dedicated screen instead of swallowing it as NEED_PASS.
const neuError = ref<Error | null>(Neu.initError);

async function initGate(): Promise<void> {
  const neuResult = await Neu.ensureInitialized();
  if (neuResult.isError()) {
    neuError.value = neuResult.error;
    return;
  }
  neuError.value = null;

  // Gpg/Pass remain lazy and failable — failures surface as readiness issues.
  await Promise.allSettled([
    Gpg.ensureInitialized(),
    Pass.ensureInitialized(),
  ]);

  await activeStore.load();

  const storePath = activeStore.storePath;
  if (storePath) {
    await readiness.evaluate(storePath);
  }
}

async function retryNeu(): Promise<void> {
  neuError.value = null;
  await initGate();
}

onMounted(initGate);

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
  <!-- Critical: Neu failed — app paralyzed, distinct from normal blocking issues -->
  <div
    v-if="neuError"
    class="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center"
  >
    <h1 class="text-xl font-semibold">Critical failure</h1>
    <p class="text-sm text-muted-foreground max-w-md">
      Unable to resolve home directory — the app cannot start.
    </p>
    <p class="text-xs text-destructive max-w-md wrap-break-word">
      {{ neuError.message }}
    </p>
    <button
      class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
      @click="retryNeu"
    >
      Retry
    </button>
  </div>
  <LoadingScreen v-else-if="activeStore.isValidating || readiness.isEvaluating" />
  <BlockedScreen
    v-else-if="!readiness.isReady || !activeStore.hasStore"
  />
  <slot v-else />
</template>
