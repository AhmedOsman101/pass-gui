<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useActiveStoreStore } from "@/stores/active-store";
import { useReadinessStore } from "@/stores/readiness";
import { Gpg } from "@/services/gpg";
import { Neu } from "@/services/neutralino";
import { Pass } from "@/services/pass";
import LoadingScreen from "./LoadingScreen.vue";

const route = useRoute();
const router = useRouter();
const readiness = useReadinessStore();
const activeStore = useActiveStoreStore();

/**
 * Routes that render inside the gate but outside its blocking check —
 * they handle blocked states themselves (onboarding reacts to readiness
 * snapshots and guides remediation).
 */
const BLOCKED_CHECK_EXEMPT = new Set(["/onboarding"]);
const isExempt = computed(() => BLOCKED_CHECK_EXEMPT.has(route.path));

// Distinct critical error: Neu (HOME_DIR) is core API — if it fails the
// entire app is paralyzed, not a normal readiness issue. Gate shows a
// dedicated screen instead of swallowing it as NEED_PASS.
const neuError = ref<Error | null>(Neu.initError);
/**
 * True once initGate has settled (store loaded, readiness evaluated).
 * Before that, a null snapshot reads as "blocked" — the forward
 * redirect must not fire during startup.
 */
const initialized = ref(false);

async function initGate(): Promise<void> {
  const neuResult = await Neu.ensureInitialized();
  if (neuResult.isError()) {
    neuError.value = neuResult.error;
    return;
  }
  neuError.value = null;

  // Gpg/Pass remain lazy and failable — failures surface as readiness issues.
  await Promise.allSettled([Gpg.ensureInitialized(), Pass.ensureInitialized()]);

  await activeStore.load();

  const storePath = activeStore.storePath;
  if (storePath) {
    await readiness.evaluate(storePath);
  }
  initialized.value = true;
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
  },
);

/**
 * Forward redirect: blocked (non-READY or no store) → /onboarding,
 * except exempt routes. Fires only after init settled — a null
 * snapshot before that would read as "blocked" — and never on Neu
 * failure (that has its own critical screen).
 */
watch(
  () => ({
    settled: initialized.value,
    evaluating: activeStore.isValidating || readiness.isEvaluating,
    blocked: !readiness.isReady || !activeStore.hasStore,
    neuFailed: neuError.value !== null,
    onOnboarding: route.path === "/onboarding",
  }),
  (snap) => {
    if (!snap.settled || snap.evaluating || snap.neuFailed) return;
    if (snap.blocked && !snap.onOnboarding) {
      void router.replace("/onboarding");
    }
  },
  { immediate: true },
);

/**
 * Reverse redirect handled on the onboarding page itself (READY → "/").
 */
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
  <template v-else-if="isExempt">
    <!-- Exempt routes (onboarding) render regardless of readiness -->
    <slot />
  </template>
  <slot v-else-if="readiness.isReady && activeStore.hasStore" />
  <!-- Blocked pre-redirect: the watcher sends these to /onboarding;
       LoadingScreen covers the one-frame gap. -->
  <LoadingScreen v-else />
</template>
