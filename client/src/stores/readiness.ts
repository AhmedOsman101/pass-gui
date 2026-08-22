import { computed, type Ref, ref } from "vue";
import { wrapAsync } from "lib-result";
import { defineStore } from "pinia";
import { Logger } from "@/lib/logger";
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
  const error = ref<Error | null>(null) as Ref<Error | null>;

  const state = computed<ReadinessState>(
    () => snapshot.value?.state ?? "NEED_PASS"
  );

  const isReady = computed(
    () => state.value === "READY" || state.value === "STORE_EMPTY"
  );

  const blockingIssues = computed<ReadinessIssue[]>(
    () => snapshot.value?.issues.filter(i => i.severity === "blocking") ?? []
  );

  const infoIssues = computed<ReadinessIssue[]>(
    () => snapshot.value?.issues.filter(i => i.severity === "info") ?? []
  );

  async function evaluate(storePath: string): Promise<void> {
    isEvaluating.value = true;
    error.value = null;

    const result = await wrapAsync(async () => await Readiness.check(storePath));
    if (result.isError()) {
      await Logger.error(
        `readiness.evaluate("${storePath}") failed: ${result.error.message}`
      );
      error.value = result.error;
      snapshot.value = null;
    } else {
      snapshot.value = result.ok;
      const blocking = result.ok.issues.filter(i => i.severity === "blocking");
      if (blocking.length > 0) {
        await Logger.error(
          `readiness.evaluate("${storePath}") -> ${result.ok.state}:`,
          blocking.map(i => i.code).join(", ")
        );
      }
    }

    isEvaluating.value = false;
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
