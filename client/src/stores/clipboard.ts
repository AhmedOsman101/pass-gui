import type { Result } from "lib-result";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  ClipboardClearError,
  ClipboardWriteError,
} from "@/services/clipboard";
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
 * Timer ownership: this store owns the setTimeout. Views
 * read `formattedRemaining` and `isActive` for the countdown UI.
 *
 * Actions return `Result` — state mutations happen via `.inspect()` /
 * `.inspectErr()` side effects. No try/catch, no toasts.
 */
const CLEAR_RETRY_MS = 5000;

const useClipboardStore = defineStore("clipboard", () => {
  const lastAction = ref<ClipboardAction | null>(null);
  const remainingMs = ref(0);
  // Plain closure variable — nothing renders the raw timer id reactively.
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const isCopied = ref(false);
  const error = ref<Error | null>(null);

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
      timerId = setTimeout(tick, Math.min(remaining, 1000));
    }

    remainingMs.value = expiresAt - Date.now();
    timerId = setTimeout(tick, Math.min(remainingMs.value, 1000));
  }

  function stopTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    remainingMs.value = 0;
  }

  async function copy(
    secret: string,
    entryPath: string
  ): Promise<Result<ClipboardAction, ClipboardWriteError>> {
    error.value = null;

    const result = await Clipboard.writeText(secret, entryPath);
    result
      .inspect(action => {
        lastAction.value = action;
        isCopied.value = true;
        startTimer(action.expiresAt);
      })
      .inspectErr(err => {
        error.value = err;
      });

    return result;
  }

  async function clear(): Promise<Result<void, ClipboardClearError>> {
    error.value = null;

    const result = await Clipboard.clear();

    result
      .inspect(() => {
        stopTimer();
        isCopied.value = false;
        lastAction.value = null;
      })
      .inspectErr(err => {
        // Failed clear keeps "still copied" state truthful: lastAction and
        // the countdown stay alive so the UI keeps showing the secret as
        // live. If the timer already fired (auto-clear path), schedule a
        // short retry instead of leaving the secret with no countdown.
        // ponytail: fixed-interval retry; add backoff if retries get noisy.
        error.value = err;
        if (lastAction.value !== null && remainingMs.value <= 0) {
          startTimer(Date.now() + CLEAR_RETRY_MS);
        }
      });

    return result;
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
  };
});

export { useClipboardStore };
