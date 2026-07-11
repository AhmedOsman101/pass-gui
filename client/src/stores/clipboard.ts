import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { Clipboard } from "@/services/clipboard";
import type { ClipboardAction } from "@/types/entries";

/**
 * Manages clipboard state — copy, auto-clear timer, and countdown feedback.
 *
 * The timer uses drift correction: each tick recalculates remaining
 * from `expiresAt - Date.now()` rather than decrementing a counter.
 * If the app is backgrounded and `setTimeout` fires late, the clear
 * still happens immediately.
 *
 * Timer ownership: this store owns the setTimeout. Phase 04 views
 * read `formattedRemaining` and `isActive` for the countdown UI.
 */
const useClipboardStore = defineStore("clipboard", () => {
  const lastAction = ref<ClipboardAction | null>(null);
  const remainingMs = ref(0);
  const timerId = ref<ReturnType<typeof setTimeout> | null>(null);
  const isCopied = ref(false);
  const error = ref<string | null>(null);

  const isActive = computed(() => isCopied.value && remainingMs.value > 0);

  const formattedRemaining = computed(() => {
    const seconds = Math.ceil(remainingMs.value / 1000);
    return `${seconds}s`;
  });

  function startTimer(expiresAt: number): void {
    stopTimer();

    function tick(): void {
      const now = Date.now();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        remainingMs.value = 0;
        // Timer callback — clear() is async but we're in a setTimeout context.
        // The clipboard write is fire-and-forget here; errors surface via error.value.
        void clear();
        return;
      }

      remainingMs.value = remaining;
      // Drift correction: schedule next tick based on actual remaining
      timerId.value = setTimeout(tick, Math.min(remaining, 1000));
    }

    remainingMs.value = expiresAt - Date.now();
    timerId.value = setTimeout(tick, Math.min(remainingMs.value, 1000));
  }

  function stopTimer(): void {
    if (timerId.value !== null) {
      clearTimeout(timerId.value);
      timerId.value = null;
    }
    remainingMs.value = 0;
  }

  async function copy(
    secret: string,
    entryPath: string
  ): Promise<ClipboardAction | null> {
    error.value = null;

    const result = await Clipboard.writeText(secret, entryPath);
    if (result.isError()) {
      error.value = `Clipboard write failed: ${result.error.message}`;
      return null;
    }

    lastAction.value = result.ok;
    isCopied.value = true;
    startTimer(result.ok.expiresAt);

    return result.ok;
  }

  async function clear(): Promise<void> {
    error.value = null;
    stopTimer();

    const result = await Clipboard.clear();
    if (result.isError()) {
      error.value = `Clipboard clear failed: ${result.error.message}`;
    }

    isCopied.value = false;
    lastAction.value = null;
  }

  return {
    lastAction,
    remainingMs,
    isCopied,
    error,
    isActive,
    formattedRemaining,
    copy,
    clear,
    startTimer,
    stopTimer,
  };
});

export { useClipboardStore };
