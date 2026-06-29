# Backend Readiness Phase — Implementation Plan

**Date**: 2026-06-18
**Status**: SUPERSEDED by `docs/plans/2026-06-27-onboarding-state-machine.md`

> **⚠️ This plan is outdated.** The readiness layer was implemented via the onboarding state machine plan.
> Key differences from what was built:
> - **10-state model** (NEED_PASS, NEED_TREE, NEED_GPG, GPG_NO_KEYS, STORE_NOT_FOUND, STORE_NO_GPG_ID, STORE_GPG_ID_EMPTY, STORE_GPG_ID_KEY_MISSING, STORE_EMPTY, READY) — not the 5-state model described here
> - **File**: `client/src/services/readiness.ts` (not `app-readiness.ts`)
> - **No Pinia store** — readiness check logs to debug console; Phase 04 will add the store
> - **`ReadinessSnapshot`** has `{ state, issues, evaluatedAt: number }` — no metadata fields
> - **`ReadinessIssue`** is a discriminated union with per-variant context fields — not a flat `{ code, message, details? }` object
> - **`execCmd()` still throws on non-zero exit** — `CommandFailedError` is used (not plain Error)
> - **`StoreValidationError`** uses `STORE_ERROR_CODES` with codes like `STORE_GPG_ID_MISSING` (not `GPG_ID_MISSING`)
> - **`execScoped()`** takes `(args, options?)` — not `(env, args)`
> - The `main.ts` init flow still blocks on `gpgInitialized`/`passInitialized` — Phase 05 will remove these

## Background

pass-gui is a desktop GUI for the standard Unix password manager `pass`. It wraps `pass` and GPG under a graphical interface. The codebase already has working config (TOML file with Zod validation), six backend services (Neutralino command runner, filesystem, config, pass, gpg, store management), shell security, and UI components (shadcn-vue sidebar, buttons, etc).

What does not exist is a single answer to "Can this app operate right now, and if not, why not?"

Currently the app starts by awaiting three module-level promises:
```ts
await neuInitialized;  // Neutralino runtime ready
await gpgInitialized;  // GPG binary detected
await passInitialized; // pass binary detected
```
If any of these fail, the app never renders. There is no graceful degradation — no screen that says "pass is not installed, here is how to fix it." The service init also runs at import time (side-effect promises), which makes it hard to control the sequence.

The spec for this phase defines a 10-step validation pipeline that runs in fixed order and produces a `ReadinessSnapshot` — a data object that says either "everything is ready" or "here is exactly what is wrong." Once built, the app startup will call the readiness pipeline once, and future frontend code will react to the snapshot.

**Files you will create:**
- `client/src/services/store-validation.ts` — validates one password store's structure, .gpg-id, recipients, and runs a safe `pass ls`
- `client/src/services/app-readiness.ts` — orchestrates the full pipeline, returns `ReadinessSnapshot`
- `client/src/stores/readiness.ts` — reactive Pinia store wrapping the orchestrator

**Files you will modify:**
- `client/src/types/index.ts` — add 5 new types
- `client/src/lib/errors.ts` — add `StoreValidationError` class and error codes
- `client/src/services/neutralino.ts` — fix `execCmd()` to stop throwing on non-zero exit
- `client/src/main.ts` — replace blocking service awaits with non-blocking readiness check
- `TODO.md` — mark Phase 02 items complete

## Goal

The app can determine at startup whether pass, GPG, and the active password store are usable. It returns a deterministic snapshot with one of five states (`DEPENDENCIES_MISSING`, `GPG_NOT_INITIALIZED`, `STORE_NOT_FOUND`, `STORE_INVALID`, `READY`), a list of structured issues, and validated metadata. A Pinia readiness store exists for future frontend code to consume.

## Constraints and Assumptions

- All existing services (`neu`, `fs`, `config`, `pass`, `gpg`, `StoreService`) are already implemented and working. You do not build new command wrappers.
- The project uses `Result<T, E>` from `lib-result` for all fallible operations. Never throw for expected failures.
- TypeScript strict mode. Types go in `client/src/types/`. Errors go in `client/src/lib/errors.ts`.
- The `pass` binary must be at least version 1.7.0 (`PASS_MIN_VERSION` in `constants.ts`).
- The active store is determined by `config.core.active_store` which references a key in `config.stores`.
- Only the active store is validated. Not all configured stores.
- No UI code in this phase. No onboarding flows. No visual blocked-state screens.
- `path.ts` from `@/lib/path` has tilde expansion helpers.
- The `gpg` service has `listSecretKeys()` and `listSecretKeysWithHome(gnupgHome)` methods for listing keys under custom `GNUPGHOME`.

## Approach Overview

The plan has three logical phases:

1. **Fix a bug in `neu.execCmd()`** — it currently throws an Error on any non-zero exit code, which is wrapped by `lib-result` into an `Err`. This destroys information because non-zero exits are meaningful (e.g., `pass show nonexistent` returns exit code 1 = "not found", not "crash"). The readiness pipeline and future entry operations both need to inspect the actual exit code. Fix: return `Ok(result)` regardless of exit code. Callers already check `exitCode` — audit confirms this is safe.

2. **Build the readiness types and services** — Create the domain model first (types), then the store-validation service (file-level operations like reading .gpg-id and running pass ls), then the orchestrator (10-step pipeline), then the Pinia store wrapper.

3. **Wire it into the app** — Replace the blocking `await gpgInitialized` / `await passInitialized` in `main.ts` with a non-blocking readiness check. Update `TODO.md`.

The alternative of growing `PassService.init()` into an orchestrator was rejected — it would mix low-level command execution with high-level startup policy and make multi-store switching harder later.

---

## Steps

### Step 1: Fix `neu.execCmd()` to stop throwing on non-zero exit

**File**: `client/src/services/neutralino.ts`, around lines 95-98

**What**: Remove the `throw new Error(...)` block that fires when a command's exit code is not zero. Instead, always return `Ok(result)` and let the caller inspect `result.exitCode` to decide what the exit code means.

**Why**: The readiness orchestrator needs to run `pass ls` and check the exit code. Phase 03 entry operations will need to distinguish "entry not found" (exit 1) from a crash. Currently, non-zero exit causes a throw that `wrapAsyncThrowable` converts into `Err(...)`, making every non-zero exit indistinguishable from a NeutralinoJS runtime failure.

**Watch for**: Every existing caller must be checked to ensure this change doesn't break them. The callers are:
- `commandExists()` — checks `exitCode === 0` explicitly (lines ~154, 162). Safe.
- `resolveBinaryPath()` — checks `exitCode !== 0` explicitly (lines ~187, 201). Safe.
- `safeExec()` — delegates to `execCmd()`, just passes the result through. The caller must check exitCode. Safe.
- `pass.passExists()` — calls `safeExec()`, checks `result.ok.exitCode !== 0` (line ~98). Safe.
- `gpg.parseVersion()` — calls `safeExec()`, checks `result.ok.exitCode !== 0` (line ~80). Safe.
- `gpg.listSecretKeys()` — calls `safeExec()`, checks `result.ok.exitCode !== 0` (line ~150). Safe.

All six callers already inspect the exit code after getting the result. No regressions.

**Verify**: `pnpm typecheck` passes. `pnpm lint` passes. No existing functionality breaks.

---

### Step 2: Add readiness types to the type system

**File**: `client/src/types/index.ts`

**What**: Add five new types at the bottom of the file and export them. These are the shared domain model for the entire readiness layer.

The types are:

- `ReadinessState` — a string union of five possible states:
  - `"DEPENDENCIES_MISSING"` — pass or GPG binary not found
  - `"GPG_NOT_INITIALIZED"` — GPG exists but has no secret keys
  - `"STORE_NOT_FOUND"` — configured store path does not exist
  - `"STORE_INVALID"` — store path exists but fails validation
  - `"READY"` — everything passes

- `ReadinessIssueCode` — a string union of 11 machine-readable issue codes:
  - `"PASS_NOT_FOUND"`, `"PASS_VERSION_UNSUPPORTED"`, `"GPG_NOT_FOUND"`, `"NO_SECRET_KEYS"`, `"STORE_PATH_MISSING"`, `"STORE_PATH_NOT_DIRECTORY"`, `"GPG_ID_MISSING"`, `"GPG_ID_EMPTY"`, `"GPG_ID_PARSE_FAILED"`, `"RECIPIENT_NOT_IN_KEYRING"`, `"BEHAVIORAL_CHECK_FAILED"`

- `ReadinessIssue` — an object with:
  - `code: ReadinessIssueCode`
  - `message: string` (human-readable, suitable for UI display)
  - `details?: Record<string, string>` (optional supporting data, e.g. which binary path or which recipient key)

- `ReadinessSnapshot` — the full result object:
  - `state: ReadinessState`
  - `issues: ReadinessIssue[]`
  - `passInfo: { found: boolean; version: string | null; path: string | null }`
  - `gpgInfo: { found: boolean; version: string | null; path: string | null; secretKeys: number }`
  - `activeStore: { name: string; path: string; gnupgHome: string | null } | null`
  - `checkedAt: string` — ISO 8601 timestamp of when the check ran

- `StoreValidationErrorCode` — the error codes for the new error class in Step 3. Same codes as the structural `ReadinessIssueCode` values that relate to store validation: `"GPG_ID_MISSING"`, `"GPG_ID_EMPTY"`, `"GPG_ID_PARSE_FAILED"`, `"RECIPIENT_NOT_IN_KEYRING"`, `"STORE_PATH_NOT_DIRECTORY"`, `"STORE_PATH_MISSING"`.

**Why**: These types are the shared contract between the orchestrator, the store-validation service, and the future Pinia store. Keeping them in `types/index.ts` follows the existing project convention.

**Verify**: `pnpm typecheck` passes with no errors from the new types.

---

### Step 3: Add `StoreValidationError` class

**File**: `client/src/lib/errors.ts`

**What**: Add a new error class and a constant map following the same pattern as the existing `ConfigValidationError`.

Add:
- `STORE_VALIDATION_ERROR_CODES` — a frozen object mapping error code strings to a shared type value `"StoreValidationError"`. The keys are: `GPG_ID_MISSING`, `GPG_ID_EMPTY`, `GPG_ID_PARSE_FAILED`, `RECIPIENT_NOT_IN_KEYRING`, `STORE_PATH_NOT_DIRECTORY`, `STORE_PATH_MISSING`.
- `type StoreValidationErrorCode` — derived from the keys of the constant above.
- `class StoreValidationError extends Error` — has two extra properties:
  - `code: StoreValidationErrorCode`
  - `storePath: string`
  Constructor takes `(code, storePath, message)` and calls `super(message)`.

**Why**: The store-validation service needs typed errors for .gpg-id failures and path issues. Using a dedicated error class (rather than generic `Error`) follows the existing pattern where `ConfigValidationError` has its own `code` and `zodError` fields. This lets the orchestrator switch on `error.code` to build the right `ReadinessIssue`.

**Verify**: `pnpm typecheck` passes. The new class is exported from `errors.ts` and importable by other modules.

---

### Step 4: Create the store-validation service

**File**: Create `client/src/services/store-validation.ts`

**What**: A service that validates a single password store directory. It does not know about config, active store, or orchestration — it receives a path and optional `GNUPGHOME` and validates.

Write four functions:

1. **`validateStoreStructure(storePath)`** — Returns a `Result` containing a structure report:
   - Whether the store path exists as a directory (`fs.isDirectory()`)
   - Whether `.gpg-id` exists at `<storePath>/.gpg-id` (`fs.exists()`)
   - Whether `.gpg-id` is empty or has only whitespace (`fs.readFile()` then trim + check length)
   If `.gpg-id` read fails for a reason other than "not found" (e.g., permissions), return `Err`.
   These checks are the "structural validation" steps 6a-6d from the spec.

2. **`parseGpgId(storePath)`** — Returns a `Result` containing parsed recipients:
   - Read `<storePath>/.gpg-id` via `fs.readFile()`
   - Split by newlines, trim each line, filter out empty lines
   - If the filtered list is empty, return `Err(new StoreValidationError("GPG_ID_EMPTY", ...))`
   - If the read fails unexpectedly, return `Err(new StoreValidationError("GPG_ID_PARSE_FAILED", ...))`
   - On success, return `Ok({ recipients: string[], rawContent: string })`

3. **`verifyRecipients(recipients, gnupgHome?)`** — Returns a `Result` containing:
   - `unknownKeys: string[]` — recipients not found in the GPG keyring
   - `allKnown: boolean` — convenience boolean
   - Call `gpg.listSecretKeys()` if no custom `gnupgHome`, or `gpg.listSecretKeysWithHome(gnupgHome)` if one is provided
   - For each recipient string, check if it appears as the `keyId`, `fingerprint`, or in any `userId` of any key returned. Use `.toLowerCase()` comparisons since GPG key IDs are often case-insensitive hex.
   - Recipients can be full fingerprints (40 hex chars), short key IDs (8 hex chars), or email addresses (from userId). Match against all three.
   - Return `unknownKeys` list. Do NOT return `Err` if there are unknown keys — return them in the success data so the orchestrator decides whether they are blocking.

4. **`validateStoreBehaviorally(storePath)`** — Returns a `Result` with:
   - `exitCode: number`
   - `errorOutput: string` (stderr content trimmed)
   - `passed: boolean` (true if exit code is 0)
   - Run `pass.exec([])` which internally sets `PASSWORD_STORE_DIR=<storePath>` and calls `pass` with no arguments (equivalent to `pass ls`)
   - Because of Step 1, this will NOT throw on non-zero exit. Check `result.exitCode`.
   - The stderr string comes from `result.stdErr`.
   - If the command itself fails entirely (NeutralinoJS error), return `Err`.
   - Otherwise return the exit code and stderr even if non-zero.

**Why**: Keeping store validation separate from PassService follows the roadmap's instruction: "one service for store validation." This separation means the same validation functions can be reused when multi-store validation is added later.

**Which file to import**: The service uses `fs` from `@/services/filesystem`, `gpg` from `@/services/gpg`, `pass` from `@/services/pass`, `Path` from `@/lib/path`, `StoreValidationError` from `@/lib/errors`, and standard `Result`/`Ok`/`Err` from `lib-result`.

**Verify**: `pnpm typecheck` passes. All import paths resolve correctly.

---

### Step 5: Create the readiness orchestrator

**File**: Create `client/src/services/app-readiness.ts`

**What**: A single exported async function `checkReadiness(): Promise<Result<ReadinessSnapshot>>` that runs the 10-step pipeline from the spec.

The pipeline runs in this fixed order:

1. **Validate pass**: Call `pass.passExists()`. This checks the binary exists and the version is >= 1.7.0. If it returns `Ok(false)`, produce `DEPENDENCIES_MISSING` state with issue `"PASS_NOT_FOUND"`. If the version is too low (you can detect this by checking `pass.version` after calling `passExists()`), produce `"PASS_VERSION_UNSUPPORTED"`. **Short-circuit**: if pass is missing, return immediately — there is no point checking GPG or stores.

2. **Validate GPG**: Call `gpg.gpgExists()`. If false, produce `DEPENDENCIES_MISSING` with `"GPG_NOT_FOUND"`. **Short-circuit**: return immediately.

3. **Require secret keys**: Call `gpg.listSecretKeys()`. If the result is an empty array, produce `GPG_NOT_INITIALIZED` with `"NO_SECRET_KEYS"`. **Short-circuit**: return immediately.

4. **Load config and resolve active store**: Call `ConfigService.load()`. Get `core.active_store` from the config data. Look up the store definition in `stores[activeStore]`. If the store key doesn't exist in the config, produce `STORE_INVALID` with a descriptive issue about the active store referencing a nonexistent store. (This shouldn't happen because config validation catches it, but handle it defensively.)

5. **Resolve store path and GNUPGHOME**: From the store definition, get `path` and `gnupg_home` (optional). Expand tilde in the path using `Path.resolveUserPath()`. Build the `activeStore` info object for the snapshot.

6. **Structural store validation**: Call `validateStoreStructure(path)` from the store-validation service. Map failures:
   - Path doesn't exist → `STORE_NOT_FOUND` with `"STORE_PATH_MISSING"`
   - Path not directory → `STORE_INVALID` with `"STORE_PATH_NOT_DIRECTORY"`
   - `.gpg-id` missing → `STORE_INVALID` with `"GPG_ID_MISSING"`
   - `.gpg-id` empty → `STORE_INVALID` with `"GPG_ID_EMPTY"`
   Collect all issues found (don't stop at the first one), but if path doesn't exist, skip the rest (can't validate .gpg-id or run pass ls on a nonexistent path).

7. **Parse recipients**: Call `parseGpgId(path)`. If it errors with `GPG_ID_EMPTY` or `GPG_ID_PARSE_FAILED`, add appropriate issue and continue (other issues may still be relevant).

8. **Verify recipients**: Call `verifyRecipients(recipients, gnupgHome)`. If there are unknown keys, add `"RECIPIENT_NOT_IN_KEYRING"` issue with details listing which keys are unknown. This does NOT short-circuit — unknown recipients are a problem but the behavioral check can still run.

9. **Behavioral check**: Call `validateStoreBehaviorally(path)`. If it fails (non-zero exit), add `"BEHAVIORAL_CHECK_FAILED"` issue with the exit code and stderr in details.

10. **Build snapshot**: Collect all issues accumulated through steps 6-9. Determine the final state:
    - If no issues at all → `"READY"`
    - If pass/GPG failed → `"DEPENDENCIES_MISSING"`
    - If no secret keys → `"GPG_NOT_INITIALIZED"`
    - If store path missing → `"STORE_NOT_FOUND"`
    - Any other store issue → `"STORE_INVALID"`

The snapshot must include:
- The final determined `state`
- All issues collected (in order encountered)
- `passInfo` with `found`, `version` (from `pass.version`), and `path` (from `pass.validatePassBinary()`)
- `gpgInfo` with `found`, `version` (from `gpg.version`), `path` (from `gpg.validateGpgBinary()`), and `secretKeys` (count of `gpg.listSecretKeys()`)
- `activeStore` with `name`, `path`, `gnupgHome`
- `checkedAt` as `new Date().toISOString()`

**Snapshot construction helper**: Create a local helper function or object builder that takes the discovered values and returns a `ReadinessSnapshot`. This keeps the pipeline function readable.

**Why**: This is the single startup decision point the roadmap requires. Every future component will import the readiness store (Step 6) rather than calling services directly.

**Verify**: `pnpm typecheck` passes. All five readiness states can be produced by feeding appropriate conditions. Pass/gpg metadata is included in the snapshot.

---

### Step 6: Create the readiness Pinia store

**File**: Create `client/src/stores/readiness.ts`

**What**: A Pinia setup store (function form, matching `stores/counter.ts` pattern) that wraps the readiness orchestrator in reactive state.

The store must have:

- **State**:
  - `snapshot: ReadinessSnapshot | null` — null until first check completes
  - `loading: boolean` — true while `checkReadiness()` is running
  - `lastCheckedAt: string | null` — ISO timestamp of last successful check

- **Computed/getters**:
  - `isReady: boolean` — true when `snapshot.state === "READY"`
  - `blockingState: ReadinessState | null` — the state if not ready, null if ready or not yet checked
  - `issues: ReadinessIssue[]` — the issue list from the snapshot, empty if no snapshot

- **Actions**:
  - `async checkReadiness(): Promise<Result<ReadinessSnapshot>>` — sets `loading = true`, calls `checkReadiness()` from `app-readiness.ts`, stores the result in `snapshot`, sets `lastCheckedAt`, sets `loading = false`, returns the result

**Why**: The roadmap requires "a store contract for future state layer" — this is it. Phase 04 frontend will import `useReadinessStore()` and react to `isReady` / `blockingState` to render the correct screen. Defining it now locks the boundary.

**Verify**: `pnpm typecheck` passes. The store can be imported and used without errors.

---

### Step 7: Wire readiness into `main.ts`

**File**: `client/src/main.ts`

**What**: Replace the two blocking service-init awaits with a single non-blocking readiness check.

Remove:
```ts
import { passInitialized } from "@/services/pass";
import { gpgInitialized } from "./services/gpg";
```
and the lines:
```ts
await gpgInitialized;
await passInitialized;
```

Add:
```ts
import { useReadinessStore } from "@/stores/readiness";
```

After `await neuInitialized;`, add:
```ts
const readinessStore = useReadinessStore();
readinessStore.checkReadiness(); // non-blocking — store updates reactively
```

Do NOT `await` the readiness check. The store is reactive — when the check completes, the snapshot updates automatically. Future frontend code will react to `isReady` and `blockingState`. If you await it, the app startup hangs if a system command hangs.

Keep the `import { pass } from "@/services/pass"` and `import { gpg } from "./services/gpg"` imports if they are referenced elsewhere, but the `*Initialized` imports and awaits can go.

**Why**: This fixes the known architecture issue where service init failures blocked the app entirely. Now `gpg.init()` and `pass.init()` still run at import time (module-level side effects) but the app does not block on them. Their results (even if failures) are consumed by the readiness pipeline which surfaces issues gracefully.

**Watch for**: The `pass` and `gpg` imports from `@/services/pass` and `@/services/gpg` might still be needed if other code imports them via `main.ts`. Check that existing imports that go through `main.ts` are not broken. Typically each service file exports its singleton independently, so removing the import from `main.ts` only affects `main.ts` itself.

**Verify**: `pnpm typecheck` passes. The app starts without waiting for gpg/pass init. The readiness store is populated after the check completes.

---

### Step 8: Update TODO.md

**File**: `TODO.md` (repo root)

**What**: Mark all Phase 02 items as completed. The specific TODO.md sections to update are:

- Section 1.1: add checkmark to `[ ] Provide onboarding flow if pass doesn't exist` (handled by readiness issues, actual onboarding UI deferred to Phase 04)
- Section 1.2: add checkmark to `[ ] Ensure at least one secret key exists` and `[ ] Detect and support custom GNUPGHOME`
- Section 3.1: add checkmark to `[ ] Ensure .gpg-id is not empty`
- Section 3.2: add checkmarks to all three items (parse .gpg-id, verify recipients, detect unknown recipients)
- Section 3.3: add checkmarks to both items (safe pass ls, fail on non-zero)
- Section 4: add checkmarks to `DEPENDENCIES_MISSING`, `GPG_NOT_INITIALIZED`, `STORE_NOT_FOUND`, `STORE_INVALID`, `READY`, and `Centralized state manager`. Leave `UI reacts strictly to state changes` and `No UI logic outside state transitions` unchecked (those are Phase 04).

**Why**: TODO.md is the authoritative checklist. Keeping it in sync prevents confusion about what's been done.

**Verify**: Re-read `TODO.md` and confirm all Phase 02 items are marked complete, with the two UI items intentionally left for Phase 04.

---

## Verification

After all steps are implemented, run these checks:

1. `pnpm typecheck` — must pass with zero errors.
2. `pnpm lint && pnpm format` — must pass with zero issues.
3. Verify the `neu.execCmd()` fix by tracing through all callers mentally or by inspection. Confirm none of them depended on the throw behavior.
4. Review `types/index.ts` — all five new types should be exported and structurally correct.
5. Review `errors.ts` — `StoreValidationError` and `STORE_VALIDATION_ERROR_CODES` should follow the same pattern as `ConfigValidationError`.
6. Review `store-validation.ts` — all four functions should handle their edge cases (empty .gpg-id, missing .gpg-id, unknown recipients, non-zero pass ls exit).
7. Review `app-readiness.ts` — the pipeline should produce the correct state for each scenario:
   - Pass missing → `DEPENDENCIES_MISSING` with `PASS_NOT_FOUND`
   - GPG missing → `DEPENDENCIES_MISSING` with `GPG_NOT_FOUND`
   - No secret keys → `GPG_NOT_INITIALIZED` with `NO_SECRET_KEYS`
   - Store path does not exist → `STORE_NOT_FOUND`
   - .gpg-id missing or invalid recipients → `STORE_INVALID`
   - Everything valid → `READY`
8. Review `main.ts` — no `await gpgInitialized` or `await passInitialized`. The readiness store is created but not awaited.
9. Review `stores/readiness.ts` — matches the Pinia setup store pattern from `counter.ts`.

## Open Questions

1. **GNUPGHOME propagation**: The `GpgService` has a `homeDir` field from its own init, but the store-validation service may need to verify recipients under a per-store `GNUPGHOME`. `gpg.listSecretKeysWithHome(gnupgHome)` should handle this. Check `gpg.ts` to confirm it exists and works correctly.

2. **Empty store behavior**: An empty password store (directory exists, .gpg-id is present with valid recipients, but no .password files) should pass structural and cryptographic validation. `pass ls` on an empty store should return exit 0 with empty output. If a particular `pass` version behaves differently, note it as a version quirk.

3. **The `pass` service init still runs at import time**: `pass.ts` has `const passInitialized = pass.init()` at module scope. Even after removing the `await` from `main.ts`, this line still executes when the module is first imported. If `pass.init()` does heavy work (filesystem checks, env var lookups), it could still block. If this is a problem, `pass.init()` could be made lazy, but that is out of scope for this phase.
