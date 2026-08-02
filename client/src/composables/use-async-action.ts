import type { Result } from "lib-result";
import { type Ref, ref } from "vue";

/**
 * Function signature accepted by `useAsyncAction`.
 * Any async function returning a `Result` works — store actions,
 * service methods, raw async I/O.
 */
export type AsyncAction<
  TArgs extends unknown[],
  TResult,
  TError extends Error,
> = (...args: TArgs) => Promise<Result<TResult, TError>>;

export type UseAsyncActionReturn<
  TArgs extends unknown[],
  TResult,
  TError extends Error,
> = {
  isLoading: Ref<boolean>;
  error: Ref<TError | null>;
  run: (...args: TArgs) => Promise<Result<TResult, TError>>;
};

/**
 * Wraps any Result-returning async function with `isLoading` + `error` refs.
 *
 * Use over store actions or service methods that need local loading state
 * (e.g. button spinners, disabled inputs). Errors are surfaced on `error`
 * for the component to react to, while the returned `Result` still flows
 * back to the caller for chain-local UI (close modal, focus field).
 *
 * @example
 *   const { isLoading, error, run } = useAsyncAction(clipboardStore.copy);
 *   const result = await run("secret", "Email/work");
 *   if (result.isOk()) closeModal();
 */
export function useAsyncAction<
  TArgs extends unknown[],
  TResult,
  TError extends Error,
>(
  action: AsyncAction<TArgs, TResult, TError>
): UseAsyncActionReturn<TArgs, TResult, TError> {
  const isLoading = ref(false);
  const error = ref<TError | null>(null) as Ref<TError | null>;

  async function run(...args: TArgs): Promise<Result<TResult, TError>> {
    isLoading.value = true;
    error.value = null;

    const result = await action(...args);
    result.inspectErr(e => {
      error.value = e;
    });

    isLoading.value = false;
    return result;
  }

  return { isLoading, error, run };
}
