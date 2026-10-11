<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Check, ChevronLeft, ChevronRight } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { computeSteps } from "@/lib/step-machine";
import { useActiveStoreStore } from "@/stores/active-store";
import { useReadinessStore } from "@/stores/readiness";
import type { ConfigStatus, OnboardingStepId } from "@/types/onboarding";

const route = useRoute();
const router = useRouter();
const readiness = useReadinessStore();
const activeStore = useActiveStoreStore();

/**
 * Reverse redirect (decision Q2): landing on /onboarding while the app
 * is READY goes straight back to the main app — no confirmation.
 * Route is part of the source so manual navigation re-triggers it.
 */
watch(
  () => ({
    appReady: readiness.isReady && activeStore.hasStore,
    path: route.path,
  }),
  ({ appReady, path }) => {
    if (appReady && path === "/onboarding") {
      void router.replace("/");
    }
  },
  { immediate: true }
);

// Skeleton ConfigStatus: config problems surface today through the
// store load error; ticket #27 replaces this with real content
// validation (expand–contract — the step machine already consumes it).
const configStatus = computed<ConfigStatus>(() => ({
  exists: activeStore.error === null,
  schemaValid: activeStore.error === null,
  contentValid: null,
}));

const machine = computed(() =>
  computeSteps(readiness.snapshot, configStatus.value)
);

// Which step the rail highlights. Defaults to the machine's current
// step; Back/Next move the selection within the fixed five steps.
const selectedStepId = ref<OnboardingStepId>(machine.value.currentStepId);

watch(machine, (value) => {
  selectedStepId.value = value.currentStepId;
});

const selectedStep = computed(
  () =>
    machine.value.steps.find(s => s.id === selectedStepId.value) ??
    machine.value.steps[0]
);

function selectOffset(offset: number): void {
  const index = machine.value.steps.findIndex(
    s => s.id === selectedStepId.value
  );
  const next = machine.value.steps[index + offset];
  if (next) selectedStepId.value = next.id;
}

const statusStyles: Record<string, string> = {
  done: "border-primary bg-primary/10 text-foreground",
  current: "border-primary text-foreground",
  pending: "border-border text-muted-foreground",
  skipped: "border-border border-dashed text-muted-foreground",
};
</script>

<template>
  <div class="flex h-full items-center justify-center overflow-auto px-4 py-8">
    <div class="w-full max-w-xl space-y-6">
      <div class="space-y-1 text-center">
        <h1 class="text-xl font-semibold">Set up pass-gui</h1>
        <p class="text-sm text-muted-foreground">
          Resolve each step so the app can start.
        </p>
      </div>

      <!-- Fixed progress rail: all five steps, always visible -->
      <ol class="space-y-1">
        <li v-for="step in machine.steps" :key="step.id">
          <button
            class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent"
            :class="[
              statusStyles[step.status],
              step.id === selectedStepId ? 'ring-1 ring-primary' : '',
            ]"
            @click="selectedStepId = step.id"
          >
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs"
            >
              <Check v-if="step.status === 'done'" class="size-3.5" />
              <template v-else>{{ step.status === "skipped" ? "–" : "" }}</template>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium">{{ step.label }}</span>
              <span class="block truncate text-xs text-muted-foreground">
                {{
                  step.status === "skipped"
                    ? "Handled during store init"
                    : step.description
                }}
              </span>
            </span>
          </button>
        </li>
      </ol>

      <!-- Step body: per-step remediation content lands with #25+ -->
      <div class="rounded-lg border p-4">
        <p class="text-sm font-medium">{{ selectedStep.label }}</p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ selectedStep.description }}
        </p>
      </div>

      <div class="flex items-center justify-between">
        <RouterLink
          to="/settings"
          class="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Settings
        </RouterLink>
        <div class="flex gap-2">
          <Button
            variant="outline"
            :disabled="selectedStepId === machine.steps[0].id"
            @click="selectOffset(-1)"
          >
            <ChevronLeft class="size-4" />
            Back
          </Button>
          <Button
            :disabled="selectedStepId === machine.steps[machine.steps.length - 1].id"
            @click="selectOffset(1)"
          >
            Next
            <ChevronRight class="size-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
