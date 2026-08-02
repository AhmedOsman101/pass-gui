# Result Migration — Architecture Spec

**Status:** Draft. Awaiting grilling confirmation before plan + tickets.
**Date:** 2026-08-02
**Companion:** [`docs/grilling/2026-08-02-result-migration-decisions.md`](../grilling/2026-08-02-result-migration-decisions.md) — full Q&A log.

---

## Destination

All four domains (`active-store`, `clipboard`, `entry-tree`, `entry-form`) migrated to the 4-layer architecture. No `try/catch` outside service boundaries. Each domain has unit tests for service + store, with rollback/optimistic-update paths covered.

## The four layers (recap)

```
Component -> Store action / Composable -> Service (wrapAsyncThrowable) -> I/O
                    <-────────── Result<T, E> ──────────┘
```

| Layer      | Owns                                                                      | Never does                               |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| Service    | async I/O, `Result` construction, domain error classes                    | reactivity, state, UI decisions          |
| Store      | shared state, cross-component mutation logic, optimistic updates/rollback | view-local state, DOM/routing/toasts     |
| Composable | local reactive wrapping, reusable stateless-ish behavior                  | domain-shared state (-> store territory) |
| Component  | rendering, event wiring, local-only UI state                              | business rules, direct service calls     |

`Result` flows unchanged service -> store -> composable/component. Every layer `.match()` / `.inspect()` / `.andThen()` at the point where it actually needs to react.

## Architecture decisions (locked in grilling)

### Error model

- **One error class per service op.** Not per service. e.g. `CreateStoreError`, `AddStoreError` are distinct classes.
- **Return type is unioned:** `Result<T, FooError | BarError | Error>`. Caller narrows via `instanceof`.
- **No shared base class.** No `AppError`. Each service owns its types.
- **`ErrFromObject` is banned.** Use `Err(new MyError(...))` or `ErrFromText("msg")` only.

### Service patterns

- **Async I/O:** `wrapAsync(fn)` for one-offs, `wrapAsyncThrowable(fn)` for reusable exports.
- **Sync throwers** (e.g. `JSON.parse`, validators): `wrap(fn)` / `wrapThrowable(fn)`.
- **Catches:** always `ErrFromUnknown(e)`.
- **Service owns recipes.** Multi-step orchestrations (e.g. `Store.create` = mkdir -> pass init -> config write) live in service. Service undoes its own filesystem mess (idempotent cleanup: if mkdir succeeded but pass init failed, rmdir).

### Pass service global state

- `Pass.exec(args, options)` already accepts `ExecCommandOptions` (`cwd`, `envs`, `stdIn`, `background`) and passes through to `Neu.exec`. **No new overload needed.**
- Recipe callers (e.g. `Store.create`) use `Pass.exec(args, { cwd: path, envs: { PASSWORD_STORE_DIR: path } })` to scope a single call without mutating `this.storePath`.
- `Pass.setStorePath` stays only for the active-store switcher + app startup. Removed in slice 4 when that switcher migrates.

### Store actions

- **Return `Result<T, E>`.** Callers get the Result for local reactions (toast, close modal).
- **Update store state via side-effect on Result.** `result.match({ okFn, errFn })` or `result.inspect(...) / inspectErr(...)`.
- **Rollback lives here** for state mutations (optimistic update + revert). FS rollback lives in service.
- **No toast import.** No DOM, no router, no notifications.

### Composables

- `useAsyncAction(fn)` — wraps any `(...args) => Promise<Result<T, E>>` with `isLoading` + `error` refs. Works over store actions or raw service calls.
- `useNotifyResult(result, { ok?, err? })` — `.match()` + sonner toast. Returns the original Result so caller chains `.match()` for local UI.
- Promote domain composables to stores when state becomes shared (use-tree-state, use-generation-config are candidates).

### Components

- Call store action or composable.
- React to returned `Result` for local concerns (toast via `useNotifyResult`, close modal, focus field).
- Validation lives here for trivial UI rules (regex, uniqueness). Never call services directly. Never `try/catch`.

### Event-stream services (exception)

`services/watcher.ts` and similar EventEmitter-style APIs are the **one** legitimate `try/catch` source. Subscription site (e.g. `stores/entry-tree.ts` listens for FS changes) wraps in a single `try/catch` -> logs -> re-subscribes. Documented exception, never spread.

## Minimal store refactor template

```ts
// stores/<name>.ts — before
async function addItem(dto: Dto) {
  isLoading.value = true;
  try {
    const data = await Service.create(dto);
    items.value.push(data);
    return data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    return null;
  } finally {
    isLoading.value = false;
  }
}

// stores/<name>.ts — after
async function addItem(dto: Dto): Promise<Result<Item, CreateError | Error>> {
  isLoading.value = true;
  error.value = null;

  const result = await Service.create(dto);
  result
    .inspect(item => items.value.push(item))
    .inspectErr(err => {
      error.value = err;
    });

  isLoading.value = false;
  return result;
}
```

## 5-point store migration checklist

Pre-PR review:

1. **No `try/catch`.** Replace with `Result.match` / `inspectErr`. Exception: watcher-style event subscriptions (documented).
2. **Every action returns `Result<T, E>`.** Not the value, not null.
3. **`error` ref holds `Error | null`**, not `string | null`. Type narrows for free in components.
4. **Rollback handled inside action.** Optimistic update + revert on `errFn`. FS rollback belongs in service.
5. **No `toast`, no router, no DOM imports.** Store doesn't know UI exists.

## Domain ordering

| Order | Domain         | Why                                                                    |
| ----- | -------------- | ---------------------------------------------------------------------- |
| 1     | `clipboard`    | Tiny surface. Sets useAsyncAction + useNotifyResult pattern.           |
| 2     | `entry-tree`   | Adds rollback/optimistic update. Eats `useClipboardBuffer` composable. |
| 3     | `entry-form`   | Largest multi-step orchestration. Validates rollback pattern.          |
| 4     | `active-store` | AddStoreWizard — worst case. Removes `Pass.setStorePath` finally.      |

## Out of scope

- Component-level tests (`__tests__/*.test.ts` for components) — manual visual review only.
- `services/dialog.ts` — UI library wrapper, not domain logic.
- `services/store-walker.ts` — pure walker, no I/O.
- `lib/errors.ts` refactor — separate concern.
- zod schema migration — Q6 ruled out (YAGNI for current validation surface).
- `use-password-generator` — inspect during slice 3, don't pre-decide.

## Open questions

None. Ready for plan + tickets.
