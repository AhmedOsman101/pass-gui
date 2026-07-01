import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { Readiness } from "@/services/readiness";
import type {
  ReadinessIssue,
  ReadinessSnapshot,
  ReadinessState,
} from "@/types/readiness";

/**
 * Manages the application's readiness state machine.
 *
 * Calls `Readiness.check()` on evaluation and maps the snapshot
 * to reactive state that views consume. No business logic here —
 * just state hydration from the readiness orchestrator.
 */
const useReadinessStore = defineStore("readiness", () => {
  const snapshot = ref<ReadinessSnapshot | null>(null);
  const isEvaluating = ref(false);
  const error = ref<string | null>(null);

  const state = computed<ReadinessState>(
    () => snapshot.value?.state ?? "NEED_PASS"
  );

  const isReady = computed(() => state.value === "READY");

  const blockingIssues = computed<ReadinessIssue[]>(
    () => snapshot.value?.issues.filter(i => i.severity === "blocking") ?? []
  );

  const infoIssues = computed<ReadinessIssue[]>(
    () => snapshot.value?.issues.filter(i => i.severity === "info") ?? []
  );

  async function evaluate(storePath: string): Promise<void> {
    isEvaluating.value = true;
    error.value = null;

    try {
      snapshot.value = await Readiness.check(storePath);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      snapshot.value = null;
    } finally {
      isEvaluating.value = false;
    }
  }

  function reset(): void {
    snapshot.value = null;
    error.value = null;
    isEvaluating.value = false;
  }

  return {
    snapshot,
    isEvaluating,
    error,
    state,
    isReady,
    blockingIssues,
    infoIssues,
    evaluate,
    reset,
  };
});

export { useReadinessStore };
