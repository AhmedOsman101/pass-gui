# Tickets: Result Migration

Apply the 4-layer lib-result architecture across all four domains of pass-gui. Source: [`docs/specs/2026-08-02-result-migration-architecture.md`](specs/2026-08-02-result-migration-architecture.md).

**Slice shape:** Horizontal per domain (service → store → component → tests). Intentional — per user decision Q13 B (free-form tickets) + Q27 (Issue = domain, Sub-issue = step). Each ticket is one session of work.

Work the **frontier**: any ticket whose blockers are all done.

---

## T1 — Add `useAsyncAction` composable

**What to build:** A generic async wrapper that takes any `(...args) => Promise<Result<T, E>>` function and returns `{ isLoading, error, run }`. Used by components and stores that call async actions and need local loading state.

**Blocked by:** None — can start immediately.

- [x] `composables/use-async-action.ts` created with signature `(action: (...args) => Promise<Result<T, E>>)` returning `{ isLoading: Ref<boolean>, error: Ref<E | null>, run: (...args) => Promise<Result<T, E>> }`
- [x] `error` resets to `null` before each call
- [x] `isLoading` set to `false` on completion (success or failure)
- [x] Unit test: `__tests__/use-async-action.test.ts` — happy path + error path
- [x] `mask typecheck` clean

---

## T2 — Add `useNotifyResult` composable

**What to build:** A toast wrapper that takes a `Result` and shows success/error notifications. Returns the original Result so the caller can chain `.match()` for local UI (close modal, focus field, etc.).

**Blocked by:** None — can start immediately.

- [x] `composables/use-notify-result.ts` created with signature `(result: Result<T, E>, opts?: { ok?: string | ((v: T) => string), err?: string | ((e: E) => string) }) => Result<T, E>`
- [x] On `Ok`: call `toast.success(msg)` where msg is `opts.ok` string or derived from function
- [x] On `Err`: call `toast.error(msg)` where msg is `opts.err` string or derived from function
- [x] Returns the original Result unchanged (no side effects on the value)
- [x] Default messages: `"Success"` for ok, `error.message` for err
- [x] Unit test: `__tests__/use-notify-result.test.ts` — ok + err paths
- [x] `mask typecheck` clean

---

## T3 — Document `Pass.exec` scoped-call pattern

**What to build:** `Pass.exec` already accepts `ExecCommandOptions` (`cwd`, `envs`, `stdIn`, `background`) which flows through to `Neu.exec`. Document how recipe callers use `Pass.exec(args, { cwd: path, envs: { PASSWORD_STORE_DIR: path } })` to scope a single call without mutating `this.storePath`.

**Blocked by:** None — can start immediately.

- [x] Add a JSDoc note on `Pass.exec` explaining the scoped-call pattern: pass `cwd` and override `PASSWORD_STORE_DIR` via `envs`
- [x] Add a smoke test: assert `Pass.exec(["show", "test"], { cwd: "/tmp", envs: { PASSWORD_STORE_DIR: "/tmp" }})` resolves without mutating `Pass.storePath`
- [x] `mask typecheck` clean

---

## T4 — Refactor `services/clipboard.ts`

**What to build:** Tighten service signatures. Ensure per-op error classes. Current `Clipboard` class is mostly correct (already returns `Result`), but `writeText` loads config inside — verify the recipe is clean and error types are distinct per method.

**Blocked by:** None — can start immediately.

- [x] `Clipboard.readText()` returns `Result<string, ClipboardReadError>` (rename `ClipboardError` → `ClipboardReadError` for clarity)
- [x] `Clipboard.writeText()` returns `Result<ClipboardAction, ClipboardWriteError>`
- [x] `Clipboard.clear()` returns `Result<void, ClipboardClearError>`
- [x] Each error class extends `Error` with a typed `cause` field
- [x] No `try/catch` in service body
- [x] `mask typecheck` clean

---

## T5 — Refactor `stores/clipboard.ts`

**What to build:** Store actions return `Result<T, E>` instead of swallowing errors into string refs. `error` ref holds `Error | null`, not `string | null`.

**Blocked by:** T4 (needs error classes from service).

- [x] `copy()` returns `Result<ClipboardAction, ClipboardWriteError>` — sets `error.value` via `.inspectErr()`, starts timer on success
- [x] `clear()` returns `Result<void, ClipboardClearError>` — sets `error.value` via `.inspectErr()`, stops timer
- [x] `error` ref typed as `Error | null` (not `string | null`)
- [x] No `try/catch` in store body
- [x] Unit test: `__tests__/clipboard.test.ts` — happy path + error path for both actions
- [ ] `mask typecheck` clean

---

## T6 — Update clipboard consumers

**What to build:** Components that call `useClipboardStore()` now receive `Result` from actions. Use `useNotifyResult` for toasts, `useAsyncAction` if there's button-spinning. No inline `toast.error(...)`.

**Blocked by:** T1, T2, T5.

- [x] Every call site of `clipboardStore.copy()` uses `useNotifyResult` or chains `.match()` for local UI
- [x] No component imports `toast` directly for clipboard-related errors
- [x] No `try/catch` in clipboard component code
- [ ] `mask typecheck` clean

---

## T7 — Write clipboard tests (batch)

**What to build:** Service + store tests for the clipboard domain. Services get full coverage. Stores get happy + failure paths with `@pinia/testing`.

**Blocked by:** T6 (code is finalized before tests).

- [x] `services/__tests__/clipboard.test.ts` — `readText`, `writeText`, `clear` happy + error paths
- [x] `stores/__tests__/clipboard.test.ts` — `copy` + `clear` happy + error paths with mock service
- [x] All tests pass
- [ ] `mask typecheck` clean

---

## T8 — Refactor `services/entries.ts` + `services/filesystem.ts`

**What to build:** Result types and per-op error classes for the entry and filesystem services. Both currently return `Result`, but some error types need tightening.

**Blocked by:** None — can start immediately.

- [ ] `entries.ts` methods have distinct error classes per operation (`EntriesReadError`, `EntriesWriteError`, etc.)
- [ ] `filesystem.ts` methods have distinct error classes per operation (`FsMkdirError`, `FsReadError`, etc.)
- [ ] No `try/catch` in service body (the two existing in `filesystem.ts` are converted)
- [ ] `mask typecheck` clean

---

## T9 — Refactor `stores/entry-tree.ts`

**What to build:** Store actions return `Result<T, E>`. Remove `try/catch`. Implement optimistic update + rollback pattern where applicable.

**Blocked by:** T8 (needs error classes from services).

- [ ] All store actions return `Result<T, E>` (not `string | null` or plain values)
- [ ] `error` ref typed as `Error | null`
- [ ] No `try/catch` in store body
- [ ] Optimistic updates use the pattern: save previous → apply optimistic → on error, revert
- [x] Unit test: `__tests__/entry-tree.test.ts` — happy + rollback paths
- [ ] `mask typecheck` clean

---

## T10 — Fold `useClipboardBuffer` into `stores/entry-tree.ts`

**What to build:** `composables/use-clipboard-buffer.ts` holds tree-level copy/cut/paste buffer state. This is shared across all tree views — it belongs in the entry-tree store. Delete the composable.

**Blocked by:** T9 (store must be refactored first).

- [ ] `stores/entry-tree.ts` gains `buffer` ref + `copyEntry`, `cutEntry`, `pasteEntry` actions
- [ ] `composables/use-clipboard-buffer.ts` deleted
- [ ] All imports updated from `useClipboardBuffer()` to `useEntryTreeStore()`
- [ ] Buffer state is `readonly` (no external mutation)
- [ ] `mask typecheck` clean

---

## T11 — Update entry-tree consumers

**What to build:** Components that call entry-tree store actions now receive `Result`. Use `useNotifyResult` for toasts, `useAsyncAction` for loading states.

**Blocked by:** T1, T2, T9, T10.

- [ ] Every call site of entry-tree store actions uses `useNotifyResult` or chains `.match()`
- [ ] No component imports `toast` directly for entry-tree errors
- [ ] No `try/catch` in entry-tree component code
- [ ] `mask typecheck` clean

---

## T12 — Write entry-tree tests (batch)

**What to build:** Service + store tests for the entry-tree domain. Focus on rollback paths for optimistic updates.

**Blocked by:** T11 (code is finalized before tests).

- [x] `services/__tests__/entries.test.ts` — all methods, happy + error paths
- [x] `services/__tests__/filesystem.test.ts` — all methods, happy + error paths
- [x] `stores/__tests__/entry-tree.test.ts` — happy + rollback paths for each action
- [x] All tests pass
- [ ] `mask typecheck` clean

---

## T13 — Refactor `services/pass.ts` + `services/gpg.ts`

**What to build:** Per-op error classes for pass and gpg services. Both already return `Result`, but error types need distinct classes.

**Blocked by:** None — can start immediately.

- [ ] `pass.ts` methods have distinct error classes: `PassInitError`, `PassShowError`, `PassInsertError`, `PassVersionCheckError`
- [ ] `gpg.ts` methods have distinct error classes: `GpgKeyListError`, `GpgEncryptError`, `GpgDecryptError`
- [ ] No `try/catch` in service body
- [ ] `mask typecheck` clean

---

## T14 — Refactor `stores/entry-form.ts`

**What to build:** Store actions return `Result<T, E>`. Multi-step orchestration (create entry → write content → add to tree) uses `Result` chaining. Rollback on failure.

**Blocked by:** T13 (needs error classes from services).

- [ ] All store actions return `Result<T, E>`
- [ ] `error` ref typed as `Error | null`
- [ ] No `try/catch` in store body
- [ ] Multi-step orchestration uses `.andThen()` chaining
- [ ] Rollback: if step N fails, undo steps 0..N-1
- [x] Unit test: `__tests__/entry-form.test.ts` — happy + rollback paths
- [ ] `mask typecheck` clean

---

## T15 — Inspect `composables/use-password-generator.ts`

**What to build:** Evaluate whether this composable should be promoted to a store (if state is shared across components) or kept as a composable (if form-local). Make the decision and execute.

**Blocked by:** T13 (needs to know what pass/gpg services return).

- [ ] Audit: which components use this composable? Is the state shared?
- [ ] If shared → promote to `stores/password-generator.ts`, delete composable
- [ ] If local → keep as composable, refactor to use `useAsyncAction`
- [ ] Update all imports
- [ ] `mask typecheck` clean

---

## T16 — Update entry-form consumers

**What to build:** Components that call entry-form store actions now receive `Result`. Use `useNotifyResult` for toasts, `useAsyncAction` for loading states.

**Blocked by:** T1, T2, T14, T15.

- [ ] Every call site of entry-form store actions uses `useNotifyResult` or chains `.match()`
- [ ] No component imports `toast` directly for entry-form errors
- [ ] No `try/catch` in entry-form component code
- [ ] `mask typecheck` clean

---

## T17 — Write entry-form tests (batch)

**What to build:** Service + store tests for the entry-form domain. Focus on multi-step orchestration and rollback.

**Blocked by:** T16 (code is finalized before tests).

- [x] `services/__tests__/pass.test.ts` — updated for new error classes, all methods
- [x] `services/__tests__/gpg.test.ts` — updated for new error classes, all methods
- [x] `stores/__tests__/entry-form.test.ts` — happy + rollback paths for each action
- [x] All tests pass
- [ ] `mask typecheck` clean

---

## T18 — Refactor `services/store.ts` — add recipes

**What to build:** `Store.create(name, { path, gpgKeyId })` recipe: mkdir → `Pass.exec(["init", gpgKeyId], { cwd: path, envs: { PASSWORD_STORE_DIR: path } })` → config write. Internal FS rollback: if pass init fails, rmdir if we created it. `Store.add(name, { path })` recipe: validate existing store → config write.

**Blocked by:** T3 (scoped Pass.exec pattern documented).

- [ ] `Store.create(name, { path, gpgKeyId })` returns `Result<StoreConfig, CreateStoreError>`
- [ ] `Store.add(name, { path })` returns `Result<StoreConfig, AddStoreError>`
- [ ] `CreateStoreError` has variants: `MkdirFailed`, `PassInitFailed`, `ConfigWriteFailed`
- [ ] `AddStoreError` has variants: `ValidationFailed`, `AlreadyExists`, `ConfigWriteFailed`
- [ ] Internal rollback: if `Pass.exec` fails after mkdir, rmdir the created directory
- [ ] `mask typecheck` clean

---

## T19 — Refactor `stores/active-store.ts`

**What to build:** Store wraps `Store.create`/`Store.add` recipes. Actions return `Result`. State mutations (add to stores map, switch active) on success. Rollback on failure.

**Blocked by:** T18 (needs recipes from service).

- [ ] `createStore()` returns `Result<StoreConfig, CreateStoreError>` — adds to `stores` map on success
- [ ] `addStore()` returns `Result<StoreConfig, AddStoreError>` — adds to `stores` map on success
- [ ] `switchStore()` still uses `Pass.setStorePath` (last legitimate caller)
- [ ] No `try/catch` in store body
- [x] Unit test: `__tests__/active-store.test.ts` — happy + rollback paths
- [ ] `mask typecheck` clean

---

## T20 — Remove `Pass.setStorePath` from non-switcher paths

**What to build:** Audit all `Pass.setStorePath` call sites. Keep it only in the active-store switcher and app startup. Remove from any recipe or component that used it for one-off scoping (those now use `Pass.exec(args, { cwd, envs })`).

**Blocked by:** T18 (recipes use scoped calls now).

- [ ] `grep` for `setStorePath` — only 2 call sites remain: app startup and active-store switcher
- [ ] All recipe call sites use `Pass.exec(args, { cwd, envs })` instead
- [ ] `mask typecheck` clean

---

## T21 — Refactor `AddStoreWizard.vue`

**What to build:** Replace the 5-step orchestration in the component with a single `Store.create`/`Store.add` call to the store. Use `useNotifyResult` for toasts. Delete `createStore()` function from component. The wizard becomes pure UI: collects name, path, gpgKeyId, then calls one store action.

**Blocked by:** T19 (store actions), T20 (scoped calls documented).

- [ ] `AddStoreWizard.vue` calls `activeStoreStore.createStore(name, { path, gpgKeyId })` — single call
- [ ] `createStore()` orchestration function deleted from component
- [ ] `useNotifyResult` for success/error toasts
- [ ] `useAsyncAction` for loading state on the single action
- [ ] No `try/catch` in component
- [ ] `mask typecheck` clean

---

## T22 — Update remaining active-store consumers

**What to build:** SettingsPage, Switcher, and any other active-store consumers now receive `Result` from store actions. Use `useNotifyResult` or `.match()` for local UI.

**Blocked by:** T21 (store actions finalized).

- [ ] Every call site of active-store store actions uses `useNotifyResult` or `.match()`
- [ ] No component imports `toast` directly for active-store errors
- [ ] No `try/catch` in active-store component code
- [ ] `mask typecheck` clean

---

## T23 — Write active-store tests (batch)

**What to build:** Service + store tests for the active-store domain. Focus on recipes (create/add), internal FS rollback, switcher path.

**Blocked by:** T22 (code is finalized before tests).

- [x] `services/__tests__/store.test.ts` — `create` + `add` happy + error + rollback paths
- [x] `stores/__tests__/active-store.test.ts` — happy + rollback paths for each action
- [x] All tests pass
- [ ] `mask typecheck` clean
