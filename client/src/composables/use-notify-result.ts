import type { Result } from "lib-result";
import { toast } from "sonner";

type OkMessage<T> = string | ((value: T) => string);
type ErrMessage<E extends Error> = string | ((error: E) => string);

export type NotifyResultOpts<T, E extends Error> = {
  ok?: OkMessage<T>;
  err?: ErrMessage<E>;
};

/**
 * Toast wrapper around a `Result`. Shows success/error notifications
 * and returns the original `Result` unchanged so the caller can
 * chain `.match()` for local UI (close modal, focus field).
 *
 * Default messages: `"Success"` for `Ok`, `error.message` for `Err`.
 * Pass `ok`/`err` as a string for a fixed message or a function
 * to derive it from the value/error.
 *
 * @example
 *   const result = useNotifyResult(
 *     await clipboardStore.copy(secret, path),
 *     { ok: "Copied", err: e => `Copy failed: ${e.message}` }
 *   );
 *   result.match({
 *     okFn: () => closeModal(),
 *     errFn: () => focusField(),
 *   });
 */
export function useNotifyResult<T, E extends Error = Error>(
  result: Result<T, E>,
  opts: NotifyResultOpts<T, E> = {},
): Result<T, E> {
  result
    .inspect((value) => {
      const msg = opts.ok
        ? typeof opts.ok === "string"
          ? opts.ok
          : opts.ok(value)
        : "Success";
      toast.success(msg);
    })
    .inspectErr((error) => {
      const msg = opts.err
        ? typeof opts.err === "string"
          ? opts.err
          : opts.err(error)
        : error.message;
      toast.error(msg);
    });

  return result;
}
