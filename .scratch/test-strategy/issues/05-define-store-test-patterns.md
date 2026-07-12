# 05: Define Pinia store and composable test patterns

Type: research
Status: resolved

## Resolution

All store and composable test patterns documented. See `reports/task-3-report.md` for full code examples.

## Inventory

### Stores (565 LOC)

| Store       | LOC | Deps               | Timer?           | Test Pattern                                                                       |
| ----------- | --- | ------------------ | ---------------- | ---------------------------------------------------------------------------------- |
| ActiveStore | 126 | Config, Pass, Path | No               | Service-level `vi.mock`, test `load()`/`switchTo()` with mock return values        |
| Clipboard   | 109 | Clipboard          | Yes (setTimeout) | `vi.useFakeTimers()`, `vi.advanceTimersByTime()`, never `setTimeout` in assertions |
| EntryForm   | 49  | None               | No               | Pure Pinia: just set refs directly, test getters                                   |
| EntryTree   | 212 | Entries, Fs, Pass  | No               | `vi.mock("@/services/entries")`, test CRUD + refresh/selectEntry chains            |
| Readiness   | 69  | Readiness          | No               | `vi.mock("@/services/readiness")`, test `evaluate()`/`reset()`                     |

### Composables (264 LOC)

| Composable           | LOC | Deps                                       | Test Pattern                                                                   |
| -------------------- | --- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| useClipboardBuffer   | 61  | Fs, useEntryTreeStore                      | `createTestingPinia`, set store refs, call `copyEntry`/`pasteEntry`            |
| useGenerationConfig  | 25  | Config                                     | `vi.mock("@/services/config")`, test that `options` loads from Config.getValue |
| usePasswordGenerator | 30  | useGenerationConfig, generate-password lib | `vi.mock` both deps, test `regenerate()` with known return values              |
| useTreeState         | 148 | useEntryTreeStore, tree-index, tree-state  | `createTestingPinia`, set `treeStore.tree`, test keyboard nav functions        |

## Key Decisions

| Decision                      | Choice                                            | Rationale                                                                            |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Service mocking               | `vi.mock("@/services/...")` at module level       | Stores import services directly; Vitest's module-level mock is the cleanest approach |
| Store coupling in composables | `createTestingPinia({ createSpy: vi.fn })`        | Composable calls `useEntryTreeStore()` internally — need an active Pinia instance    |
| Timer tests                   | `vi.useFakeTimers()`                              | Avoids real wait; `vi.advanceTimersByTime()` for tick-by-tick control                |
| Crypto mocking                | `vi.stubGlobal("crypto", ...)`                    | `crypto.getRandomValues` is a Web API global in NeutralinoJS context                 |
| Helper pattern                | `ok()`/`err()` factory functions                  | Services return `Result` types — need `{ isError: () => false, ok: value }` shape    |
| EntryForm store               | Direct ref manipulation                           | Pure state store, no services — simplest test class                                  |
| Pinia watchers                | `store.$subscribe(spy)` / `store.$onAction(spy)`  | Built-in Pinia methods work with `@pinia/testing`                                    |
| `useRouter`/`useRoute`        | Create real `vue-router` instance, pass as plugin | Pinia's plugin system needed for stores that call `useRouter()` internally           |

## Code Examples

Full code examples for each pattern are in `reports/task-3-report.md`:

- 5a: ActiveStore — service-level mock with `ok()`/`err()` helpers
- 5b: EntryTree — CRUD mock with refresh/selection chain assertions
- 5c: Clipboard — fake timers, drift correction, expiry, error handling
- 5d: useTreeState — Pinia instance + store ref assignment, keyboard nav
- 5e: usePasswordGenerator — composable mock + crypto substitute
