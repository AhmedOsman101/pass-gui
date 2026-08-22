# Batch Review: 1 of 10
**Files:** client/src/services/clipboard.ts · client/src/stores/clipboard.ts · client/src/composables/use-notify-result.ts · client/src/composables/use-async-action.ts · client/src/components/EntryDetail.vue · client/src/components/DeleteConfirmDialog.vue
**Composition:** vertical slice (clipboard domain: service → store → composables → components)
**Reviewer:** subagent-1

## House Style Reference (restate in own words)
- Result<T,E> contract and where try/catch is allowed: all services/stores return `Result` from lib-result, chained with `.match()/.andThen()/.mapErr()/.inspect()`; try/catch exists only in logger/watcher infra.
- Store purity rules: Pinia stores are setup stores; they never import toast, router, or DOM APIs; error state is canonical `Ref<Error | null>`.
- Component error handling: components consume Results via `useNotifyResult(...)` or `.match(...)`; direct sonner imports are bugs except App.vue (global relay) and EntryDetail.vue (rich toast).
- Layer boundary rule: all I/O lives in services/; direct `Neutralino.*` calls from components or stores are design violations.

## Per-file reviews

### `services/clipboard.ts`
**Path:** client/src/services/clipboard.ts **Purpose:** Wraps Neutralino's native clipboard (read/write/clear) behind Result-returning static methods, adding config-driven timer metadata. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found. (Config re-loaded on every `writeText` — acceptable if `Config.load()` caches; see Open Questions.)

#### Minor / style
- Lines 12–49: all three error classes declare `public cause` explicitly while also passing it via the `Error` super options. ES2022 `Error` already carries `cause`; the manual field duplicates it. Harmless, but three near-identical classes could be one parameterized class or just `ClipboardWriteError` with a selection field.
- `clear()`'s `.map(() => undefined)` is fine but only needed because `wrapAsync` types the void return oddly — leave as-is if that's the established pattern.

#### Confirmed correct
- `wrapAsync` + `Err(new Clipboard…Error(...))` instead of try/catch — matches the Result contract; logger calls inside service are the allowed infra exception.
- Direct `@neutralinojs/lib` import here is correct — services own I/O.

### `stores/clipboard.ts`
**Path:** client/src/stores/clipboard.ts **Purpose:** Owns clipboard state: last action, drift-corrected auto-clear timer, countdown refs, canonical `error` ref. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Silent clear failure leaves stale secret in OS clipboard with UI showing "cleared".** Where:
```ts
const result = await Clipboard.clear();
result.inspectErr(err => {
  error.value = err;
});

isCopied.value = false;
lastAction.value = null;
```
(stores/clipboard.ts:95-101). If the OS clear fails, state resets (`isCopied=false`, `lastAction=null`, timer stopped) so every consumer believes the clipboard is clean, while the secret is still live in the OS clipboard. The `error` ref is set, but nothing in this batch reads `clipboardStore.error` — the Err branch is effectively dropped at the point where it matters most (a password manager's core safety guarantee). Fix: either keep `lastAction`/`isActive` alive on clear failure so the countdown UI persists and the user knows the secret is still exposed, or escalate — e.g. have callers route the returned Result through `useNotifyResult`. At minimum document the decision.
- **Internal timer helpers exported from the store.** `startTimer`/`stopTimer` (line 115-116) are implementation details; exposing them lets any component restart/kill the auto-clear timer for a secret they didn't copy. Return only what views need (`lastAction`, `remainingMs`, `error`, `isActive`, `formattedRemaining`, `copy`, `clear`); keep `startTimer`/`stopTimer` private in the setup closure.

#### Minor / style
- `timerId` stored in a `ref` (line 28) gains reactive overhead for a value nothing renders reactively; a plain closure variable would do. Cosmetic.
- Fire-and-forget `void clear()` in the tick callback (line 50) is commented and deliberate — fine.

#### Confirmed correct
- Setup store, no toast/router/DOM imports; `setTimeout` here is timer-state ownership explicitly documented in the docblock, and matches the brief's canonical shape (`Ref<Error | null>`).
- Returning the original `Result` from `copy`/`clear` so components can chain `.match()` — correct per contract.

### `composables/use-notify-result.ts`
**Path:** client/src/composables/use-notify-result.ts **Purpose:** Toasts Ok/Err branches of a Result and returns it unchanged for further `.match()` chaining. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
None found. The `ok?: string | fn | false` tri-state is slightly dense but well-documented with an example; not worth churn.

#### Confirmed correct
- Sonner import here is the intended funnel — components importing sonner directly are bugs *because* this composable exists; this file is the sanctioned home of the toast side effect.

### `composables/use-async-action.ts`
**Path:** client/src/composables/use-async-action.ts **Purpose:** Wraps a Result-returning async fn with `isLoading`/`error` refs for local UI state. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- If `action` ever rejects instead of resolving a Result (contract violation upstream), `run` throws and `isLoading` stays `true` forever. The type signature forbids this, so no defensive code warranted — noting only as a known ceiling.

#### Confirmed correct
- `error` ref mirrors the canonical store pattern (`Ref<TError | null>`) — matches house style, not a violation.
- No try/catch, no toast — purity respected.

### `components/EntryDetail.vue`
**Path:** client/src/components/EntryDetail.vue **Purpose:** Detail pane for the selected entry: reveal/copy secret, metadata copy, edit/rename/move/duplicate/delete actions, skeleton loading. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Clear-button Err branches dropped silently.** Where:
```ts
action: {
  label: "Clear",
  onClick: () => void clipboard.clear(),
},
```
(EntryDetail.vue:104 and :121). The Result returned by `clipboard.clear()` is discarded; combined with the store issue above, a failed clear shows nothing and the toast's "Clears in Xs" claim becomes false. Given this is the same secret-exposure path flagged in the store, fix both together: `onClick: () => useNotifyResult(await clipboard.clear(), { ok: false })` or a `.match` with an error toast.
- **Copy with empty fallback path.** `await clipboard.copy(value, treeStore.currentPath ?? "")` (EntryDetail.vue:114) fabricates an empty path so `ClipboardAction.path` is `""` and the toast description loses the entry context. `copySecret` correctly guards with early return (line 93); `copyValue` should too, rather than papering over with `?? ""`.

#### Minor / style
- `Scissors` imported from lucide (line 2) and never used in template — dead import.
- `copySecret` and `copyValue` are ~90% identical (toast block duplicated verbatim). `copySecret` could delegate: `copyValue(entry.secret, "Password")` plus the path guard. Not blocking.
- `skeletonTimer` is never cleared on unmount — a late fire mutates refs of an unmounted component (harmless today, leaks a timer). A `tryOnScopeDispose`-style cleanup or `onUnmounted` would close it.
- Mixed `ref`/`shallowRef` for booleans (lines 25–26 vs 31) — pick one.

#### Confirmed correct
- Direct `sonner` import (line 4) — EntryDetail.vue is one of the two documented exceptions (rich toast with action button).
- All clipboard interaction goes through `clipboard.copy(...)` store action consumed via `.match()` — no Neutralino calls in the component, no raw try/catch.

### `components/DeleteConfirmDialog.vue`
**Path:** client/src/components/DeleteConfirmDialog.vue **Purpose:** Confirmation dialog calling `treeStore.removeEntry`, closing on success. **Verdict:** Needs fixes

#### Critical bugs
None found.

#### Design issues
- **Dialog closes even when deletion fails, defeating the `isOk()` guard.** Where:
```ts
<AlertDialogAction
  :disabled="isDeleting"
  class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
  @click="handleDelete"
>
```
(DeleteConfirmDialog.vue:57-61) together with:
```ts
if (result.isOk()) {
  emit("update:open", false);
}
```
(DeleteConfirmDialog.vue:36-38). Radix/shadcn `AlertDialogAction` closes the dialog natively on click — before `handleDelete`'s awaited Result resolves. So on failure the dialog still closes (the `update:open` round-trip from the native close wins), leaving the user staring at the unchanged tree with only a transient toast; the success-only `emit` implies intent to stay open on error, which can't happen. Fix: prevent the native close and control it entirely, e.g. use `@click.prevent` / stop propagation per your shadcn-vue version (or swap `AlertDialogAction` for a plain `Button`) so `handleDelete` owns the open state:
```ts
async function handleDelete(e?: Event): Promise<void> {
  e?.preventDefault();
  isDeleting.value = true;
  const result = useNotifyResult(
    await treeStore.removeEntry(props.entryPath),
    { ok: false }
  );
  isDeleting.value = false;
  if (result.isOk()) emit("update:open", false);
}
```
Same reasoning makes the `:disabled="isDeleting"` spinner mostly unreachable — another symptom of the same root cause.

#### Minor / style
- Calling `useNotifyResult` mid-event-handler (line 31) works since it's a plain function, but the `use*` name reads like a setup-scope composable; fine given the house convention, just be aware linters enforcing composable-call-site rules may object.

#### Confirmed correct
- Errors surfaced via `useNotifyResult` with default `err` message (not suppressed) — matches the consumption pattern; no raw sonner import here.
- `ok: false` suppressing the success toast is deliberate (the dialog closing IS the success feedback).

## Batch Summary
- Files reviewed: 6 / 6
- Critical bugs: none at "data loss" severity; DeleteConfirmDialog.vue's close-on-failure is the closest thing (delete failure looks identical to success apart from a toast).
- Design issues worth escalating: DeleteConfirmDialog.vue (native AlertDialogAction close defeats error-path UX), stores/clipboard.ts + EntryDetail.vue (silent clipboard-clear failure on the secret-exposure path), stores/clipboard.ts (exported timer internals).
- Cross-cutting patterns in THIS batch only: clipboard `clear()` errors are produced correctly by the service, stored canonically in the store, then dropped by every consumer — the Result chain breaks at the last hop in two places. Also light duplication between `copySecret`/`copyValue` toast blocks.
- Open questions (needs owner decision): Does `Config.load()` cache, or does every password copy hit disk for config? (If it hits disk, hoist/cache — but that may be intentional elsewhere.) Should a failed clipboard clear keep the countdown UI alive (visible "still copied" state) or is best-effort clearing the accepted ceiling?

Skipped: none — all six files read in full.
