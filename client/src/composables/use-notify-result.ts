import type { Result } from "lib-result";
import { toast } from "sonner";

type OkMessage<T> = string | ((value: T) => string);
type ErrMessage<E extends Error> = string | ((error: E) => string);

type NotifyResultOpts<T, E extends Error> = {
  /** Message for the Ok branch. `false` suppresses the success toast. */
  ok?: OkMessage<T> | false;
  /** Message for the Err branch. `false` suppresses the error toast. */
  err?: ErrMessage<E> | false;
};

/**
 * Toast wrapper around a `Result`. Shows success/error notifications
 * and returns the original `Result` unchanged so the caller can
 * chain `.match()` for local UI (close modal, focus field).
 *
 * Default messages: `"Success"` for `Ok`, `error.message` for `Err`.
 * Pass `ok`/`err` as a string for a fixed message, a function
 * to derive it from the value/error, or `false` to suppress that
 * branch's toast entirely.
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
function useNotifyResult<T, E extends Error = Error>(
  result: Result<T, E>,
  opts: NotifyResultOpts<T, E> = {}
): Result<T, E> {
  result
    .inspect(value => {
      if (opts.ok === false) return;
      const msg = opts.ok
        ? typeof opts.ok === "string"
          ? opts.ok
          : opts.ok(value)
        : "Success";
      toast.success(msg);
    })
    .inspectErr(error => {
      if (opts.err === false) return;
      const msg = opts.err
        ? typeof opts.err === "string"
          ? opts.err
          : opts.err(error)
        : error.message;
      toast.error(msg);
    });

  return result;
}

export { type NotifyResultOpts, useNotifyResult };
