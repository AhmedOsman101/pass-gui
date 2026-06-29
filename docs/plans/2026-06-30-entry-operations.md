# Entry Operations — Quest Chain

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Progress

- [ ] Quest 1: The Entry Codex
- [ ] Quest 2: The Error Arsenal
- [ ] Quest 3: The Pass Ls Decoder
- [ ] Quest 4: The Pass Show Decoder
- [ ] Quest 5: The Entry Service
- [ ] Quest 6: The Clipboard Ritual
- [ ] Quest 7: The Ledger Reconciliation

**Goal:** Build the backend password-management operations — entry listing, detail retrieval, mutations, clipboard — so Phase 04 frontend stores can consume stable service contracts.

**Tech Stack:** TypeScript 5.9, lib-result (`Result<T, E>`), existing service layer (NeutralinoService, GpgService, PassService, ConfigService, filesystem).

---

## The World

The readiness state machine from Phase 02 now tells us _whether_ the app can operate. Phase 03 answers the next question: _what can we do once it's ready?_

Right now, `pass.ts` has `exec()` and `execScoped()` — low-level command runners. They can shell out to `pass ls`, `pass show`, `pass insert`, etc. But there's no parsing, no domain types, no error classes for entry operations. The frontend (Phase 04) needs structured data, not raw stdout.

We're building the middle layer: parsers that turn `pass ls` tree output into `EntryNode[]`, parsers that turn `pass show` output into `EntryDetail`, an `EntriesService` that orchestrates CRUD, and a `ClipboardService` that wraps NeutralinoJS clipboard with config-backed clearing.

**Key constraint:** `neu.execCmd()` throws `CommandFailedError` on non-zero exit. The parsers and services must handle this gracefully — "entry not found" (exit 1) is not a crash.

---

## The Pipeline

Execution order matters. Types first, then parsers, then services, then clipboard.

|  #  | Quest                     | What it builds                                                | Depends on |
| :-: | ------------------------- | ------------------------------------------------------------- | ---------- |
|  1  | The Entry Codex           | Domain types for entries, mutations, clipboard                | —          |
|  2  | The Error Arsenal         | Error classes for entry operations                            | Quest 1    |
|  3  | The Pass Ls Decoder       | Parser: `pass ls` stdout -> `EntryNode[]`                     | Quest 1    |
|  4  | The Pass Show Decoder     | Parser: `pass show` stdout -> `EntryDetail`                   | Quest 1    |
|  5  | The Entry Service         | `EntriesService` — list, show, insert, generate, rm, mv, edit | Quest 1-4  |
|  6  | The Clipboard Ritual      | `ClipboardService` — write, clear                             | Quest 1    |
|  7  | The Ledger Reconciliation | Wire into main.ts, update TODO.md                             | Quest 1-6  |

---

## Quest Chain

Complete these in order. Each quest unlocks the next.

---

### Quest 1: The Entry Codex

**Reward:** Domain types that every future parser, service, and store consumes.

Create `client/src/types/entries.ts` with these types:

- **`EntryNode`** — `{ name: string; path: string; type: "folder" | "file"; children?: EntryNode[] }`. Folders have `children`, files don't. `path` is the full store-relative path (e.g. `Email/work`).

- **`EntryTree`** — `EntryNode[]`. The root is an array, not a single root node.

- **`EntryDetail`** — `{ path: string; secret: string; metadata: Record<string, string>; other: string[]; raw: string }`. `secret` is line 1 of `pass show`. `metadata` is key:value pairs from subsequent lines. `other` is lines that don't parse as key:value. `raw` is the full stdout for debugging.

- **`MutationInput`** — `{ path: string; content: string; force?: boolean }`. Used by insert.

- **`MutationResult`** — `{ success: boolean; path: string; oldPath?: string }`. `oldPath` is set for moves/renames.

- **`ClipboardSelection`** — `"clipboard" | "primary" | "secondary"`. Matches config.

- **`ClipboardAction`** — `{ path: string; selection: ClipboardSelection; timerSeconds: number; expiresAt: number }`. What the clipboard service returns after a write.

- **`ClipboardState`** — `{ lastAction: ClipboardAction | null; remainingMs: number; isActive: boolean }`. For Phase 04 stores.

Then add `export type * from "./entries"` to `client/src/types/index.ts`.

**Verify:** `pnpm typecheck` passes. All types are importable from `@/types`.

---

### Quest 2: The Error Arsenal

**Reward:** Typed errors that `EntriesService` and `ClipboardService` return.

Add to `client/src/lib/errors.ts`, after the `StoreValidationError` section:

**Error code constant:**

```ts
const ENTRY_ERROR_CODES = Object.freeze({
  ENTRY_NOT_FOUND: "EntryNotFound",
  ENTRY_ALREADY_EXISTS: "EntryAlreadyExists",
  ENTRY_PARSE_ERROR: "EntryParseError",
  CLIPBOARD_ERROR: "ClipboardError",
  MUTATION_FAILED: "MutationFailed",
} as const);
```

**Type aliases:**

```ts
type EntryErrorCode = keyof typeof ENTRY_ERROR_CODES;
type EntryErrorType = (typeof ENTRY_ERROR_CODES)[EntryErrorCode];
```

**Five error classes**, each extending `Error`:

- `EntryNotFoundError` — fields: `code: "ENTRY_NOT_FOUND"`, `type: "EntryNotFound"`, `path: string`
- `EntryAlreadyExistsError` — fields: `code: "ENTRY_ALREADY_EXISTS"`, `type: "EntryAlreadyExists"`, `path: string`
- `EntryParseError` — fields: `code: "ENTRY_PARSE_ERROR"`, `type: "EntryParseError"`, `raw: string`
- `ClipboardError` — fields: `code: "CLIPBOARD_ERROR"`, `type: "ClipboardError"`, `selection: string`
- `MutationError` — fields: `code: "MUTATION_FAILED"`, `type: "MutationFailed"`, `exitCode: number`, `stderr: string`

Each follows the same pattern as `StoreValidationError`: constructor takes `(code, ...domainFields, message?)`, calls `super(message)`, sets all fields.

**Verify:** `pnpm typecheck` passes. All five classes and `ENTRY_ERROR_CODES` are exported.

---

### Quest 3: The Pass Ls Decoder

**Reward:** A parser that turns `pass ls` tree output into a structured `EntryNode[]`.

Create `client/src/lib/parse-pass-ls.ts`.

**Export:** `parsePassLsOutput(stdout: string): Result<EntryTree, EntryParseError>`

**Logic:**

1. If stdout is empty or whitespace-only -> return `Ok([])` (empty store is not an error).
2. Split output by newlines. The output uses Unicode box-drawing characters (`├──`, `└──`, `│   `) for tree structure. Each entry is on its own line with indentation.
3. Use a depth stack: `{ node: EntryNode; depth: number }[]`.
4. For each non-empty line:
   - Strip the tree prefix: remove all leading `│`, `├`, `└`, `─`, and space characters. The regex `^[│├└─\s]+` handles this.
   - The remaining text is the entry name. If it ends with `/`, it's a folder — strip the trailing `/` and set `type: "folder"`. Otherwise `type: "file"`.
   - Determine depth by counting how many `│   ` or `    ` prefixes precede the `├──` or `└──`. Each `│   ` or `    ` block is one level deep.
   - Build the `EntryNode` with `name`, `type`, and a `path` computed by walking the stack.
   - If deeper than stack top -> push as child of stack top's node.
   - If same depth -> pop stack top, then push as child of new stack top.
   - If shallower -> pop stack until we reach the parent depth, then push.
5. Return the root-level array (children of the implicit root).

**Edge cases to handle:**

- Names with spaces (e.g., `My Documents/`)
- Deep nesting (cap at 10 levels to prevent stack overflow)
- Empty store (returns `Ok([])`)
- Single entry (no tree characters)

**Verify:** `pnpm typecheck` passes. Test mentally with:

- Empty output -> `[]`
- `├── Email/` -> `[{ name: "Email", type: "folder", path: "Email", children: [] }]`
- `│   ├── work.gpg` inside Email -> nested child

---

### Quest 4: The Pass Show Decoder

**Reward:** A parser that turns `pass show` output into structured `EntryDetail`.

Create `client/src/lib/parse-pass-show.ts`.

**Export:** `parsePassShowOutput(stdout: string): Result<EntryDetail, EntryParseError>`

**Logic:**

1. If stdout is empty -> `Err(new EntryParseError("EMPTY_OUTPUT", "Empty pass show output"))`.
2. Split by newlines. Skip leading empty lines.
3. First non-empty line is the `secret` (password value). This is always line 1 of `pass show` output.
4. For each remaining line:
   - Split on the first `:` character.
   - If both sides are non-empty after trim -> it's a metadata key:value pair. Store in `metadata[key.trim()] = value.trim()`.
   - If no colon, or key/value is empty after split -> add to `other[]`.
5. Return `Ok({ path: "", secret, metadata, other, raw: stdout })`. The caller sets `path` after construction.

**Edge cases:**

- Single-line entry (secret only, no metadata) -> `metadata: {}`, `other: []`
- Metadata values containing colons (split on first `:` only)
- Lines with `#` comments (pass includes these — treat as `other`)
- Completely empty input -> error

**Verify:** `pnpm typecheck` passes. Test mentally with:

- `"my-password\n"` -> `{ secret: "my-password", metadata: {}, other: [] }`
- `"pass\nusername: john\nURL: https://example.com\n"` -> `{ secret: "pass", metadata: { username: "john", URL: "https://example.com" }, other: [] }`

---

### Quest 5: The Entry Service

**Reward:** A service that orchestrates all entry CRUD via `pass` CLI.

Create `client/src/services/entries.ts`.

**Class:** `EntriesService` (static methods, matching `ReadinessService` and `StoreValidationService` patterns).

**Private helper — `getActiveStorePath()`:**

- Loads config via `ConfigService.load()`
- Gets `core.active_store`, looks up in `stores`
- Expands tilde via `Path.resolveUserPath()`
- Returns `Result<string>`

**Methods:**

1. **`list()`** -> `Promise<Result<EntryTree, EntryParseError | MutationError>>`
   - Calls `getActiveStorePath()`
   - Calls `pass.execScoped(["ls"], { envs: { PASSWORD_STORE_DIR: storePath } })`
   - Since `execCmd` throws `CommandFailedError` on non-zero exit, catch it: if the error message contains "password store is empty", return `Ok([])` (empty store is valid)
   - Otherwise, parse stdout with `parsePassLsOutput()`
   - Return parsed result

2. **`show(path)`** -> `Promise<Result<EntryDetail, EntryNotFoundError | EntryParseError | MutationError>>`
   - Validates path via `validatePath()`
   - Calls `pass.execScoped(["show", path], { envs: { PASSWORD_STORE_DIR: storePath } })`
   - Catch `CommandFailedError`: if stderr contains "is not in the password store" -> `Err(new EntryNotFoundError(path))`
   - Parse stdout with `parsePassShowOutput()`
   - Set `entry.path = path` on the result
   - Return

3. **`insert(input)`** -> `Promise<Result<MutationResult, EntryAlreadyExistsError | MutationError>>`
   - Validates `input.path`
   - `pass insert` needs stdin piping (content passed via stdin with `-m` flag). Since `pass.execScoped()` can't pipe stdin, use `neu.execCmd()` directly:
     ```
     echo <quoted_content> | pass insert [-f] -m <quoted_path>
     ```
     with `envs: { PASSWORD_STORE_DIR: storePath }`
   - Use `quoteForPosix()` for content and path
   - Catch `CommandFailedError`: if stderr contains "already exists" -> `Err(new EntryAlreadyExistsError(input.path))`
   - On success -> `Ok({ success: true, path: input.path })`

4. **`generate(path, length?, noSymbols?)`** -> `Promise<Result<MutationResult, MutationError>>`
   - Reads generation defaults from config: `ConfigService.getValue("generation", "default_length")` and `ConfigService.getValue("generation", "symbols")`
   - Builds args: `["generate", path, String(length ?? defaultLength ?? 25)]`. If `noSymbols`, insert `-n` before path.
   - Calls `pass.execScoped(args, { envs: { PASSWORD_STORE_DIR: storePath } })`
   - Returns `Ok({ success: true, path })`

5. **`remove(path)`** -> `Promise<Result<MutationResult, MutationError>>`
   - Calls `pass.execScoped(["rm", "-f", path], { envs: { PASSWORD_STORE_DIR: storePath } })`
   - Returns `Ok({ success: true, path })`

6. **`move(oldPath, newPath)`** -> `Promise<Result<MutationResult, MutationError>>`
   - Calls `pass.execScoped(["mv", oldPath, newPath], { envs: { PASSWORD_STORE_DIR: storePath } })`
   - Returns `Ok({ success: true, path: newPath, oldPath })`

7. **`edit(path, content)`** -> `Promise<Result<MutationResult, MutationError>>`
   - Does NOT use `pass edit` (spawns `$EDITOR` in terminal, impossible in NeutralinoJS)
   - Uses read-show-reinsert pattern: calls `this.show(path)` to verify entry exists, then calls `this.insert({ path, content, force: true })` to overwrite
   - Returns the insert result

**Important:** `neu.execCmd()` throws `CommandFailedError` on non-zero exit. Every method must wrap calls in try/catch or use `wrapAsyncThrowable` to convert throws into `Result` errors. The `CommandFailedError` has `exitCode`, `stdOut`, `stdErr` fields for inspecting what went wrong.

**Verify:** `pnpm typecheck` passes. All methods return `Result` types. No raw throws escape.

---

### Quest 6: The Clipboard Ritual

**Reward:** A clipboard service that writes secrets and clears on demand.

Create `client/src/services/clipboard.ts`.

**Class:** `ClipboardService` (static methods).

**Imports:** `clipboard` from `@neutralinojs/lib`, `ConfigService` from `@/services/config`, error types from `@/lib/errors`, `Ok`, `Err` from `lib-result`.

**Methods:**

1. **`write(text, path)`** -> `Promise<Result<ClipboardAction, ClipboardError>>`
   - Reads config: `ConfigService.getValue("clipboard", "clear_after_seconds")` and `ConfigService.getValue("clipboard", "selection")`
   - Defaults: `clearAfterSeconds: 45`, `selection: "clipboard"`
   - NeutralinoJS only supports `"clipboard"` selection. If config says primary/secondary, silently fall back to `"clipboard"`. Do NOT error.
   - Calls `await clipboard.writeText(text)`. If throws -> `Err(new ClipboardError(selection, "Clipboard write failed"))`
   - Calculates `expiresAt = Date.now() + (clearAfterSeconds * 1000)`
   - Returns `Ok({ path, selection, timerSeconds: clearAfterSeconds, expiresAt })`

2. **`clear()`** -> `Promise<Result<void, ClipboardError>>`
   - Calls `await clipboard.writeText("")`. If throws -> `Err(new ClipboardError("clipboard", "Clipboard clear failed"))`
   - Returns `Ok(undefined)`

**Do NOT start any timer.** Timer logic lives in Phase 04's clipboard Pinia store.

**Verify:** `pnpm typecheck` passes. No `setTimeout` or timer logic in the service file.

---

### Quest 7: The Ledger Reconciliation

**Reward:** Everything wired together, TODO updated, ready for Phase 04.

1. Add `export type * from "./entries"` to `client/src/types/index.ts` (if not already done in Quest 1).

2. Update `TODO.md`:
   - Section 5 (Listing Passwords): check off items that are now implemented
   - Section 8 (Entry Operations): check off `pass show`, `pass insert`, `pass generate`, `pass edit`, `pass rm`, `pass mv`, clipboard copy
   - Leave unchecked: QR code (future), search/filter (Phase 04)

3. Run `pnpm typecheck && pnpm lint && pnpm format` — must pass clean.

4. Verify no raw throws escape from `EntriesService` or `ClipboardService` — every method returns `Result`.

5. Verify `parsePassLsOutput` handles empty store gracefully (returns `Ok([])`, not error).

6. Verify `parsePassShowOutput` correctly separates secret from metadata.

---

## Verification

After all quests are complete:

1. `pnpm typecheck` — zero errors.
2. `pnpm lint && pnpm format` — zero issues.
3. `EntriesService.list()` returns `EntryTree` (array of `EntryNode`).
4. `EntriesService.show(path)` returns `EntryDetail` with separated secret and metadata.
5. `EntriesService.insert()` creates entries, `remove()` deletes them, `move()` renames them.
6. `ClipboardService.write()` returns `ClipboardAction` with timer info. No timer started.
7. `ClipboardService.clear()` clears clipboard. No timer involved.
8. All error classes are importable and have correct `code`/`type` fields.
9. All parsers handle edge cases: empty store, missing entry, single-line entries.

---

## What Phase 04 Gets

This phase produces:

- **Types:** `EntryNode`, `EntryTree`, `EntryDetail`, `MutationInput`, `MutationResult`, `ClipboardAction`, `ClipboardState`, `ClipboardSelection`
- **Services:** `EntriesService` (list/show/insert/generate/remove/move/edit), `ClipboardService` (write/clear)
- **Parsers:** `parsePassLsOutput`, `parsePassShowOutput`
- **Errors:** `EntryNotFoundError`, `EntryAlreadyExistsError`, `EntryParseError`, `ClipboardError`, `MutationError`

Phase 04 Pinia stores consume these directly — no re-interpretation needed.

---

## Open Questions

1. **`pass insert` stdin piping:** The `echo content | pass insert -m path` approach works but exposes the password briefly in the process list. Acceptable for v1. Future improvement: write to a temp file and redirect `< tempfile`.

2. **`pass ls` on empty store:** `pass` exits non-zero with "Error: password store is empty" on some versions. The `list()` method catches this specific error message and returns `Ok([])` instead of failing. Verify this behavior on the target `pass` version (1.7.4+).

3. **`execCmd` throw behavior:** Currently throws `CommandFailedError` on non-zero exit. This is fine for now — the services catch it. If Phase 05 changes this to return `Ok(result)` with non-zero exit, the services need updating (add explicit `exitCode` checks).
