# Entry Operations — Implementation Plan

> **Spec**: `docs/specs/entry-operations.md`
> **Roadmap**: `docs/roadmap/03-entry-and-operations-backend.md`
> **Depends on**: Phase 02 (backend readiness) completely implemented

## Goal

Build the backend password-management operations — entry listing, detail retrieval, mutations (insert, generate, rm, mv, edit), clipboard behavior backed by real services — and the typed state contracts that Phase 04 frontend stores will consume. This phase produces stable service contracts and domain types only. No UI code.

## Prerequisites

- Phase 02 readiness types exist: `ReadinessState`, `ReadinessIssue`, `ReadinessSnapshot`, `ReadinessIssueCode` at `client/src/types/index.ts`
- `checkReadiness()` orchestrator exists at `client/src/services/app-readiness.ts`
- `PassService` has both `exec()` and `execScoped()` methods (from Phase 02)
- `GpgService` has both `listSecretKeys()` and `listSecretKeysWithHome()` methods (from Phase 02)
- `StoreValidationError` and `STORE_VALIDATION_ERROR_CODES` exist at `client/src/lib/errors.ts`
- `ReadinessStore` exists at `client/src/stores/readiness.ts`
- `main.ts` no longer blocks on `gpgInitialized`/`passInitialized` (only `neuInitialized` awaited)
- `Path` from `@/lib/path` is available for tilde expansion
- `neu.execCmd()` currently throws on non-zero exit code (to be fixed in Step 0)

## Critical Architecture Issue (Must Fix First)

**Problem**: `neu.execCmd()` in `client/src/services/neutralino.ts` throws an `Error` when a command exits with non-zero exit code (lines 95-98). This is wrapped by `wrapAsyncThrowable` and returned as `Err`, making it impossible to distinguish NeutralinoJS runtime failures from expected command failures. Phase 03 entry operations need to inspect the actual exit code (e.g., `pass show nonexistent` returns exit code 1, meaning "not found", not "crash").

**Fix**: Remove the throw on non-zero exit, always return `Ok(result)`. Then update the single existing caller that only checks `result.isError()` without also checking `result.ok.exitCode !== 0` — this is `validateStoreBehaviorally()` in `store-validation.ts`.

## New Types Required

### New file: `client/src/types/entries.ts`

```ts
type EntryNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: EntryNode[];
};

type EntryTree = EntryNode[];

type EntryDetail = {
  path: string;
  secret: string;
  metadata: Record<string, string>;
  other: string[];
  raw: string;
};

type MutationInput = {
  path: string;
  content: string;
  force?: boolean;
};

type MutationResult = {
  success: boolean;
  path: string;
  oldPath?: string;
};

type ClipboardSelection = "clipboard" | "primary" | "secondary";

type ClipboardAction = {
  path: string;
  selection: ClipboardSelection;
  timerSeconds: number;
  expiresAt: number;
};

type ClipboardState = {
  lastAction: ClipboardAction | null;
  remainingMs: number;
  isActive: boolean;
};

// Contract types for Phase 04 stores
type EntriesStoreState = {
  tree: EntryTree | null;
  selectedPath: string | null;
  selectedDetail: EntryDetail | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
};

type ClipboardStoreState = {
  lastAction: ClipboardAction | null;
  remainingMs: number;
};
```

## New Files to Create

### 1. `client/src/lib/parse-pass-ls.ts`

**Responsibility**: Parse `pass ls` stdout into an `EntryTree` (recursive folder/file structure with indentation-based nesting).

**Exports**:
```ts
function parsePassLsOutput(stdout: string): Result<EntryTree, EntryParseError>
```

### 2. `client/src/lib/parse-pass-show.ts`

**Responsibility**: Parse `pass show <path>` stdout into `EntryDetail` (first line = secret, remaining lines = metadata key:value pairs).

**Exports**:
```ts
function parsePassShowOutput(stdout: string): Result<EntryDetail, EntryParseError>
```

### 3. `client/src/services/entries.ts`

**Responsibility**: Orchestrate all entry CRUD commands via `PassService` and `neu.execCmd()`. Wraps `pass` CLI calls and returns typed domain results.

**Exports**:
```ts
class EntriesService {
  static async list(): Promise<Result<EntryTree, EntryParseError | MutationError>>
  static async show(path: string): Promise<Result<EntryDetail, EntryNotFoundError | EntryParseError | MutationError>>
  static async insert(input: MutationInput): Promise<Result<MutationResult, EntryAlreadyExistsError | MutationError>>
  static async generate(path: string, length?: number, noSymbols?: boolean): Promise<Result<MutationResult, MutationError>>
  static async remove(path: string): Promise<Result<MutationResult, MutationError>>
  static async move(oldPath: string, newPath: string): Promise<Result<MutationResult, MutationError>>
  static async edit(path: string, content: string): Promise<Result<MutationResult, MutationError>>
}
```

### 4. `client/src/services/clipboard.ts`

**Responsibility**: Writes entry secrets to system clipboard via NeutralinoJS clipboard API and clears on demand. Does NOT manage timer logic — that belongs in Phase 04 clipboard store.

**Exports**:
```ts
class ClipboardService {
  static async write(text: string, path: string): Promise<Result<ClipboardAction, ClipboardError>>
  static async clear(): Promise<Result<void, ClipboardError>>
}
```

## Files to Modify

### 1. `client/src/lib/errors.ts`

**Add**: After the `StoreValidationError` section (line 230), add five new error classes:

```ts
const ENTRY_ERROR_CODES = Object.freeze({
  ENTRY_NOT_FOUND: "EntryNotFound",
  ENTRY_ALREADY_EXISTS: "EntryAlreadyExists",
  ENTRY_PARSE_ERROR: "EntryParseError",
  CLIPBOARD_ERROR: "ClipboardError",
  MUTATION_FAILED: "MutationFailed",
} as const);

type EntryErrorCode = keyof typeof ENTRY_ERROR_CODES;
type EntryErrorType = (typeof ENTRY_ERROR_CODES)[EntryErrorCode];
```

Five classes, each extending `Error`:

- `EntryNotFoundError` — `code: "ENTRY_NOT_FOUND"`, `type: "EntryNotFound"`, stores `path: string`
- `EntryAlreadyExistsError` — `code: "ENTRY_ALREADY_EXISTS"`, `type: "EntryAlreadyExists"`, stores `path: string`
- `EntryParseError` — `code: "ENTRY_PARSE_ERROR"`, `type: "EntryParseError"`, stores `raw: string`
- `ClipboardError` — `code: "CLIPBOARD_ERROR"`, `type: "ClipboardError"`, stores `selection: string`
- `MutationError` — `code: "MUTATION_FAILED"`, `type: "MutationFailed"`, stores `exitCode: number`, `stderr: string`

**Export**: Add all five classes plus `ENTRY_ERROR_CODES`, `EntryErrorCode`, `EntryErrorType` to the export block.

### 2. `client/src/services/neutralino.ts`

**Critical fix**: Remove the throw on non-zero exit code (lines 95-98).

**Current**:
```ts
if (result.exitCode !== 0) {
  throw new Error(
    `Command failed with exit code ${result.exitCode}${result.stdErr.length ? `\n${result.stdErr}` : ""}`
  );
}
```

**New**: Remove the entire `if (result.exitCode !== 0)` block. The method always returns `Ok(result)` with the actual exit code in the result object. `wrapAsyncThrowable` continues to catch true NeutralinoJS runtime errors (connection failures, native API errors).

### 3. `client/src/services/store-validation.ts`

**Must fix after Step 0**: Update `validateStoreBehaviorally()` to also check `result.ok.exitCode !== 0`. After the execCmd change, non-zero exit codes are no longer thrown, so the function must inspect `exitCode` explicitly.

**Current** (lines 181-191):
```ts
if (result.isError()) {
  return Err(
    new StoreValidationError("STORE_BEHAVIORAL_CHECK_FAILED", ...)
  );
}
return Ok(undefined);
```

**New**:
```ts
if (result.isError()) {
  return Err(
    new StoreValidationError("STORE_BEHAVIORAL_CHECK_FAILED", ...)
  );
}
if (result.ok.exitCode !== 0) {
  return Err(
    new StoreValidationError("STORE_BEHAVIORAL_CHECK_FAILED",
      `pass ls exited with code ${result.ok.exitCode}`,
      { exitCode: String(result.ok.exitCode) }
    )
  );
}
return Ok(undefined);
```

### 4. Add re-export to `client/src/types/index.ts`

Add to the export block:
```ts
export type * from "./entries";
```

## Implementation Steps

### Step 0: Fix execCmd non-zero exit behavior

**File**: `client/src/services/neutralino.ts`

**Change**: Remove the `if (result.exitCode !== 0) { throw ... }` block at lines 95-98. `execCmd` should always return `Ok(result)` with the actual exit code in the result object. True runtime errors (NeutralinoJS connection issues) are still caught by `wrapAsyncThrowable`.

**Impact**: All existing callers already check `result.isError() || result.ok.exitCode !== 0` EXCEPT `validateStoreBehaviorally()` in `store-validation.ts`. That function must be updated in Step 0b.

### Step 0b: Update validateStoreBehaviorally

**File**: `client/src/services/store-validation.ts`

**Change**: After `if (result.isError()) { ... }`, add a check for `result.ok.exitCode !== 0` that also returns `STORE_BEHAVIORAL_CHECK_FAILED`. This preserves the correct behavior after Step 0 removes the throw on non-zero exit.

**Verification for Steps 0+0b**: Run `pnpm typecheck && pnpm lint && pnpm format`. If `validateStoreBehaviorally` didn't previously account for non-zero exit, the types won't catch it (it's a semantic, not type, issue). Manual verification: all other callers of `execCmd`/`safeExec`/`execScoped` already check both `isError()` and `exitCode`.

### Step 1: Add entry domain types

**File**: `client/src/types/entries.ts` (new file)

Define all types listed in "New Types Required" above:
- `EntryNode`, `EntryTree`, `EntryDetail`, `MutationInput`, `MutationResult`
- `ClipboardSelection`, `ClipboardAction`, `ClipboardState`
- `EntriesStoreState`, `ClipboardStoreState` (contract types for Phase 04)

Then add `export type * from "./entries"` to `client/src/types/index.ts`.

### Step 2: Add entry error classes

**File**: `client/src/lib/errors.ts`

Add `ENTRY_ERROR_CODES` const and 5 error classes after the `StoreValidationError` section (after line 230). Each class follows the same pattern: extends `Error`, sets `code`/`type` in constructor, stores domain-specific fields, calls `super(message)`.

Export all new types and classes.

### Step 3: Create parse-pass-ls.ts

**File**: `client/src/lib/parse-pass-ls.ts`

**`parsePassLsOutput(stdout: string): Result<EntryTree, EntryParseError>`**

**Logic**:
1. If stdout is empty or whitespace-only → return `Ok([])` (empty store is not an error).
2. Split output by newlines. Use a depth stack: `{ node: EntryNode, depth: number }[]`.
3. For each non-empty line:
   a. Count leading spaces to determine depth (2 spaces per level).
   b. Strip Unicode box-drawing prefixes (`├──`, `└──`, `│   `) via regex.
   c. Remaining text is the entry name. If it ends with `/`, type is `"folder"`. Strip trailing `/`.
   d. Build `EntryNode`. If deeper than stack top, push child. If shallower, pop from stack.
   e. Compute `path` by concatenating names from root to current node with `/`.
4. Handle edge cases: names with spaces, deep nesting (cap at 10 levels), special chars.
5. Return root-level children array with fully populated tree.
6. If parsing fails unexpectedly → `Err(new EntryParseError({ raw: stdout }))`.

### Step 4: Create parse-pass-show.ts

**File**: `client/src/lib/parse-pass-show.ts`

**`parsePassShowOutput(stdout: string): Result<EntryDetail, EntryParseError>`**

**Logic**:
1. If stdout is empty → `Err(new EntryParseError({ raw: stdout }, "Empty pass show output"))`.
2. Split by newlines. Skip leading empty lines.
3. First non-empty line is the `secret` (password value).
4. For each remaining line: split on first `:` — if both sides are non-empty after trim, it's a key/value metadata pair. Store in `metadata[ key.trim() ] = value.trim()`.
5. Lines without a colon (or empty key/value after split) go into `other[]`.
6. Return `Ok({ path: "" /* caller fills this */, secret, metadata, other, raw: stdout })`.

### Step 5: Create ClipboardService

**File**: `client/src/services/clipboard.ts`

**Imports**: `clipboard` from `@neutralinojs/lib`, `ConfigService` from `@/services/config`, `ClipboardError`, `ClipboardAction` from types, `Ok`, `Err`, `type Result` from `lib-result`.

#### `write(text, path)`

```ts
static async write(text: string, path: string): Promise<Result<ClipboardAction, ClipboardError>>
```

**Logic**:
1. Read config: `ConfigService.getValue("clipboard", "clear_after_seconds")` and `ConfigService.getValue("clipboard", "selection")`.
2. Defaults: `clearAfterSeconds: 45`, `selection: "clipboard"`.
3. NeutralinoJS only supports `"clipboard"` selection. If config says primary/secondary, silently fall back to `"clipboard"`. Do NOT error.
4. Call `await clipboard.writeText(text)`. If throws → `Err(new ClipboardError(resolvedSelection, "Clipboard write failed"))`.
5. Calculate `expiresAt = Date.now() + (clearAfterSeconds * 1000)`.
6. Return `Ok({ path, selection: resolvedSelection, timerSeconds: clearAfterSeconds, expiresAt })`.

**Do NOT start any timer. Timer lives in Phase 04 clipboard store.**

#### `clear()`

```ts
static async clear(): Promise<Result<void, ClipboardError>>
```

**Logic**:
1. Call `await clipboard.writeText("")`. If throws → `Err(new ClipboardError("clipboard", "Clipboard clear failed"))`.
2. Return `Ok(undefined)`.

### Step 6: Create EntriesService

**File**: `client/src/services/entries.ts`

**Imports**: Entry types from `@/types/entries`, error classes from `@/lib/errors`, `pass` from `@/services/pass`, `ConfigService` from `@/services/config`, `parsePassLsOutput` from `@/lib/parse-pass-ls`, `parsePassShowOutput` from `@/lib/parse-pass-show`, `validatePath` from `@/lib/shell`, `Path` from `@/lib/path`, `neu` from `@/services/neutralino`, `Ok`, `Err`, `ErrFromText`, `type Result` from `lib-result`, `quoteForPosix` from `@/lib/shell`.

All `pass.execScoped()` calls use `env` as FIRST argument, `args` as SECOND: `pass.execScoped({ PASSWORD_STORE_DIR: storePath }, ["ls"])`.

#### Step 6a: `getActiveStorePath()`

```ts
private static async getActiveStorePath(): Promise<Result<string>>
```

**Logic**:
1. Load config via `ConfigService.load()`. If `Err` → `ErrFromText("Failed to load config")`.
2. Get `core.active_store`. If undefined → `ErrFromText("No active store configured")`.
3. Look up `stores[activeStore]`. If not found → `ErrFromText('Store "X" not found in config')`.
4. Get store path. Expand tilde via `Path.resolveUserPath(storePath)`. If fails → `ErrFromText(...)`.
5. Return resolved absolute path.

This returns `Result<string>` (default Error type). Callers can map to `MutationError` if needed.

#### Step 6b: `list()`

```ts
static async list(): Promise<Result<EntryTree, EntryParseError | MutationError>>
```

**Logic**:
1. Call `getActiveStorePath()`. If `Err` → return `Err(new MutationError(1, error.message))`.
2. Call `pass.execScoped({ PASSWORD_STORE_DIR: storePath }, ["ls"])`.
3. If `Err` → `Err(new MutationError(1, "pass ls runtime error"))`.
4. If `result.ok.exitCode !== 0` → `Err(new MutationError(result.ok.exitCode, result.ok.stdErr))`.
5. Parse stdout with `parsePassLsOutput(result.ok.stdOut)`.
6. Return parsed result.

#### Step 6c: `show(path)`

```ts
static async show(path: string): Promise<Result<EntryDetail, EntryNotFoundError | EntryParseError | MutationError>>
```

**Logic**:
1. Validate path with `validatePath()`. If `Err` → `Err(new MutationError(1, "Invalid path"))`.
2. Call `getActiveStorePath()`. If `Err` → `Err(new MutationError(1, error.message))`.
3. Call `pass.execScoped({ PASSWORD_STORE_DIR: storePath }, ["show", path])`.
4. If `Err` → `Err(new MutationError(1, "pass show runtime error"))`.
5. If `result.ok.exitCode !== 0`: check stderr for "is not in the password store" → `Err(new EntryNotFoundError(path))`. Otherwise → `Err(new MutationError(exitCode, stderr))`.
6. Parse stdout with `parsePassShowOutput(result.ok.stdOut)`.
7. If parse succeeds, set `entry.path = path`.
8. Return result.

#### Step 6d: `insert(input)`

```ts
static async insert(input: MutationInput): Promise<Result<MutationResult, EntryAlreadyExistsError | MutationError>>
```

**Logic**:
1. Validate `input.path` with `validatePath()`. If `Err` → `Err(new MutationError(1, "Invalid path"))`.
2. Call `getActiveStorePath()`. If `Err` → `Err(new MutationError(1, error.message))`.
3. **Stdin piping**: `pass.execScoped()` cannot pipe stdin. Use `neu.execCmd()` directly with a shell pipe string:
   ```
   PASSWORD_STORE_DIR=<quoted_storePath> echo <quoted_content> | pass insert -m <quoted_path>
   ```
   Use `quoteForPosix()` to properly quote the content and path.
4. Build command string:
   ```ts
   const envStr = `PASSWORD_STORE_DIR=${quoteForPosix(storePath)}`;
   const contentStr = quoteForPosix(input.content);
   const pathStr = quoteForPosix(input.path);
   const forceFlag = input.force ? "-f " : "";
   const cmd = `${envStr} echo ${contentStr} | pass insert ${forceFlag}-m ${pathStr}`;
   const result = await neu.execCmd({ cmd, args: [] });
   ```
5. If `result.isError()` → `Err(new MutationError(1, "pass insert runtime error"))`.
6. If `result.ok.exitCode !== 0`: check stderr for "already exists" → `Err(new EntryAlreadyExistsError(input.path))`. Otherwise → `Err(new MutationError(exitCode, stderr))`.
7. On success → `Ok({ success: true, path: input.path })`.

**Security note**: The password content appears briefly in the process list. This is acceptable for the initial version. Future improvement: use a temp file approach (write secret to temp file with restricted permissions, pass via redirect `< tempfile`).

#### Step 6e: `generate(path, length?, noSymbols?)`

```ts
static async generate(path: string, length?: number, noSymbols?: boolean): Promise<Result<MutationResult, MutationError>>
```

**Logic**:
1. Validate path. If `Err` → `Err(new MutationError(1, "Invalid path"))`.
2. Call `getActiveStorePath()`.
3. Read generation defaults from config: `ConfigService.getValue("generation", "default_length")` and `ConfigService.getValue("generation", "symbols")`.
4. Build args: `["generate", path, String(length ?? config.default_length ?? 25)]`. If `noSymbols ?? !config.symbols`, insert `"-n"` before the path.
5. Execute via `pass.execScoped({ PASSWORD_STORE_DIR: storePath }, args)`.
6. If `Err` → `Err(new MutationError(1, "pass generate runtime error"))`.
7. If `result.ok.exitCode !== 0` → `Err(new MutationError(exitCode, stderr))`.
8. Return `Ok({ success: true, path })`.

#### Step 6f: `remove(path)`

```ts
static async remove(path: string): Promise<Result<MutationResult, MutationError>>
```

**Logic**:
1. Validate path. If `Err` → `Err(new MutationError(1, "Invalid path"))`.
2. Call `getActiveStorePath()`.
3. Build args: `["rm", "-f", path]` (force skips interactive confirmation; UI handles confirmation).
4. Execute via `pass.execScoped({ PASSWORD_STORE_DIR: storePath }, args)`.
5. If `Err` → `Err(new MutationError(1, "pass rm runtime error"))`.
6. If `result.ok.exitCode !== 0` → `Err(new MutationError(exitCode, stderr))`.
7. Return `Ok({ success: true, path })`.

#### Step 6g: `move(oldPath, newPath)`

```ts
static async move(oldPath: string, newPath: string): Promise<Result<MutationResult, MutationError>>
```

**Logic**:
1. Validate both paths. If any fails → `Err(new MutationError(1, "Invalid path"))`.
2. Call `getActiveStorePath()`.
3. Build args: `["mv", oldPath, newPath]`.
4. Execute via `pass.execScoped({ PASSWORD_STORE_DIR: storePath }, args)`.
5. If `Err` → `Err(new MutationError(1, "pass mv runtime error"))`.
6. If `result.ok.exitCode !== 0` → `Err(new MutationError(exitCode, stderr))`.
7. Return `Ok({ success: true, path: newPath, oldPath })`.

#### Step 6h: `edit(path, content)`

```ts
static async edit(path: string, content: string): Promise<Result<MutationResult, MutationError>>
```

**Logic**:
1. Validate path. If `Err` → `Err(new MutationError(1, "Invalid path"))`.
2. Call `getActiveStorePath()`. If `Err` → `Err(new MutationError(1, error.message))`.
3. Implementation approach: read-show-reinsert (NOT `pass edit`, which spawns terminal editor and cannot work in NeutralinoJS):
   a. Call `this.show(path)` to get current content. This verifies the entry exists.
   b. The caller (Phase 04 UI) provides the modified content as the `content` parameter.
   c. Call `this.insert({ path, content, force: true })` to write the modified content back over the existing path.
   d. Return the result of the insert call.
4. This method does NOT invoke `pass edit` at all — that command spawns `$EDITOR` in a terminal, which NeutralinoJS cannot support. The read-show-reinsert approach achieves the same effect in the UI.

### Step 7: Add type re-exports

**File**: `client/src/types/index.ts`

Add to the export block:
```ts
export type * from "./entries";
```

This re-exports all entry domain types from `@/types/entries` so they're accessible from `@/types`.

## Integration Points

This phase exposes these contracts consumed by Phase 04 (frontend UI):

1. **`EntryTree`**, **`EntryDetail`**, **`MutationResult`**, **`ClipboardAction`**, **`ClipboardState`** types: Phase 04 Pinia stores manage state with these types.
2. **`EntriesService`**: Phase 04 entries store calls `EntriesService.list()`, `.show()`, `.insert()`, etc.
3. **`ClipboardService`**: Phase 04 clipboard store calls `ClipboardService.write()` and `.clear()`. Timer logic is handled by Phase 04 (never in the service).
4. **`parsePassLsOutput` / `parsePassShowOutput`**: Phase 04 may use these for client-side re-parsing if needed.
5. **`EntryNotFoundError`**, **`EntryAlreadyExistsError`**, etc.: Phase 04 stores map these to user-facing messages.
6. **`EntriesStoreState`** and **`ClipboardStoreState`** types: Define the shape that Phase 04 Pinia stores will implement.
7. **`neu.execCmd()` no longer throws on non-zero exit**: Phase 04 mutations rely on this for distinguishing error types.

## Verification Checklist

- [ ] `pnpm typecheck` passes with all new types, parsers, services
- [ ] `pnpm lint && pnpm format` passes
- [ ] `neu.execCmd` returns `Ok(result)` even when exit code is non-zero
- [ ] All existing callers of `neu.execCmd` still work correctly (checked: `passExists`, `gpgExists`, `gpg.parseVersion`, `gpg.listSecretKeys`, `commandExists`, `resolveBinaryPath`)
- [ ] `validateStoreBehaviorally()` still correctly detects `pass ls` failures (updated to check `exitCode`)
- [ ] `parsePassLsOutput` correctly parses `pass ls` output with folders and files at multiple indentation levels
- [ ] `parsePassLsOutput` returns empty array for empty store (not an error)
- [ ] `parsePassLsOutput` handles deeply nested folders (5+ levels)
- [ ] `parsePassLsOutput` handles entry names with spaces and special characters
- [ ] `parsePassShowOutput` correctly separates first non-empty line as secret
- [ ] `parsePassShowOutput` correctly parses metadata as key-value pairs (split on first `:`)
- [ ] `parsePassShowOutput` stores non-key-value lines in `other[]`
- [ ] `parsePassShowOutput` handles single-line entries (secret only, no metadata)
- [ ] `parsePassShowOutput` returns error for completely empty input
- [ ] `EntriesService.list()` returns a tree matching the actual store structure
- [ ] `EntriesService.show("nonexistent")` returns `EntryNotFoundError`
- [ ] `EntriesService.show(path)` returns secret + metadata correctly separated
- [ ] `EntriesService.insert({ path, content })` creates a new entry visible in subsequent listing
- [ ] `EntriesService.insert({ path, content })` without force on existing path returns `EntryAlreadyExistsError`
- [ ] `EntriesService.generate(path, 20)` creates an entry with a 20-character password
- [ ] `EntriesService.remove(path)` removes the entry (listing no longer shows it)
- [ ] `EntriesService.move(oldPath, newPath)` renames/moves the entry
- [ ] `ClipboardService.write("secret", "path")` writes to the system clipboard
- [ ] `ClipboardService.clear()` immediately clears clipboard content
- [ ] `ClipboardService.write()` does NOT start any timer (verified by code review — no `setTimeout` in service file)
- [ ] `ClipboardService.write()` silently falls back to `"clipboard"` when config specifies primary/secondary
- [ ] Store paths with `~` are correctly expanded to absolute paths in `getActiveStorePath`
