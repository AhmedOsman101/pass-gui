# Backend Readiness Phase — Implementation Plan

> **Spec**: `docs/specs/backend-readiness.md`
> **Roadmap**: `docs/roadmap/02-backend-foundation-and-readiness.md`
> **Depends on**: Config system, PassService, GpgService, StoreService, filesystem service all implemented

## Goal

Implement the backend readiness pipeline: a deterministic validation chain that checks pass, GPG, and the active store, then produces a `ReadinessSnapshot` with a machine-readable state (`DEPENDENCIES_MISSING`, `GPG_NOT_INITIALIZED`, `STORE_NOT_FOUND`, `STORE_INVALID`, `READY`) and a list of structured `ReadinessIssue` objects. This is the hard gate the app must pass before any password-management feature can operate.

**Status: ALL STEPS COMPLETE** — this phase has been fully implemented. The plan below documents the final state for future reference. No pending work remains.

## Prerequisites

- `PassService` exists at `client/src/services/pass.ts` with `validatePassBinary()`, `passExists()`, `checkVersion()`, `exec()`, `execScoped()` methods
- `GpgService` exists at `client/src/services/gpg.ts` with `gpgExists()`, `listSecretKeys()`, `listSecretKeysWithHome()`, `exec()` methods
- `ConfigService` exists at `client/src/services/config.ts` with `load()`, `getValue()`, `ensure()` methods
- `StoreService` exists at `client/src/services/store.ts` with `get()`, `validatePath()` methods
- `NeutralinoService` (`neu`) exists at `client/src/services/neutralino.ts` with `safeExec()`, `execCmd()`, `getEnv()`, `resolveBinaryPath()`, `commandExists()` methods
- Filesystem service (`fs`) exists at `client/src/services/filesystem.ts` with `isDirectory()`, `readFile()`, `exists()` methods
- Shell helpers exist at `client/src/lib/shell.ts` (`validatePath()`, `buildShellCommand()`, `quoteForPosix()`)
- Error classes exist at `client/src/lib/errors.ts` (`NeuError`, `ConfigNotFoundError`, etc.)
- Version comparison exists at `client/src/lib/utils.ts` (`compareVersions()`)
- `PASS_MIN_VERSION`, `SYSTEM_PASS_PATHS` constants exist at `client/src/lib/constants.ts`
- Path helpers exist at `client/src/lib/path.ts` (`expandTilde`, `resolveUserPath`)

## New Types Required

### 1. `ReadinessState` — in `client/src/types/index.ts`

```ts
type ReadinessState =
  | "DEPENDENCIES_MISSING"
  | "GPG_NOT_INITIALIZED"
  | "STORE_NOT_FOUND"
  | "STORE_INVALID"
  | "READY";
```

### 2. `ReadinessIssueCode` — in `client/src/types/index.ts`

```ts
type ReadinessIssueCode =
  | "PASS_NOT_FOUND"
  | "PASS_VERSION_UNSUPPORTED"
  | "GPG_NOT_FOUND"
  | "GPG_NO_SECRET_KEYS"
  | "ACTIVE_STORE_UNDEFINED"
  | "STORE_CONFIG_MISSING"
  | "STORE_PATH_NOT_FOUND"
  | "STORE_PATH_NOT_DIRECTORY"
  | "STORE_GPG_ID_MISSING"
  | "STORE_GPG_ID_EMPTY"
  | "STORE_RECIPIENT_PARSE_FAILED"
  | "STORE_RECIPIENT_UNKNOWN"
  | "STORE_BEHAVIORAL_CHECK_FAILED";
```

### 3. `ReadinessIssue` — in `client/src/types/index.ts`

```ts
type ReadinessIssue = {
  code: ReadinessIssueCode;
  message: string;
  details?: Record<string, string>;
};
```

### 4. `ReadinessSnapshot` — in `client/src/types/index.ts`

```ts
type ReadinessSnapshot = {
  state: ReadinessState;
  issues: ReadinessIssue[];
  passInfo: PassBinaryInfo | null;
  passVersion: Version | null;
  gpgInfo: GpgBinaryInfo | null;
  gpgVersion: Version | null;
  gpgHome: string | null;
  secretKeyCount: number;
  activeStoreName: string | null;
  activeStorePath: string | null;
  activeStoreGnupgHome: string | null;
  checkedAt: number;
};
```

## New Files Created

### 1. `client/src/services/store-validation.ts`

**Responsibility**: Validates a single password store's structure (path, .gpg-id), parses recipient IDs, verifies them against the GPG keyring, and runs a safe behavioral check with `pass ls`.

**Exports**:

```ts
function validateStoreStructure(storePath: string): Promise<Result<void, StoreValidationError>>
function parseGpgId(storePath: string): Promise<Result<string[], StoreValidationError>>
function verifyRecipients(recipientIds: string[], gnupgHome: string): Promise<Result<boolean, StoreValidationError>>
function validateStoreBehaviorally(storePath: string): Promise<Result<void, StoreValidationError>>
```

All functions accept already-resolved store paths (tilde already expanded by caller).

### 2. `client/src/services/app-readiness.ts`

**Responsibility**: Orchestrates the full readiness pipeline — validates pass, GPG, config, active store, recipients, and behavioral check, then returns a single `ReadinessSnapshot`. This is the single backend source of truth for startup readiness.

**Exports**:

```ts
function checkReadiness(): Promise<Result<ReadinessSnapshot>>
```

The return type has no concrete error type because all expected failures are captured as `ReadinessIssue` objects inside the snapshot. The outer `Result` only errors on unexpected runtime failures (e.g. `NeuError` from NeutralinoJS itself).

### 3. `client/src/stores/readiness.ts`

**Responsibility**: Pinia store that consumes the readiness orchestrator and exposes reactive readiness state for UI. Must not reimplement backend logic.

**Exports**:

```ts
function useReadinessStore(): {
  snapshot: Ref<ReadinessSnapshot | null>;
  loading: Ref<boolean>;
  lastCheckedAt: Ref<number | null>;
  checkReadiness: () => Promise<void>;
  isReady: ComputedRef<boolean>;
  blockingState: ComputedRef<ReadinessState | null>;
  issues: ComputedRef<ReadinessIssue[]>;
};
```

## Files Modified

### 1. `client/src/types/index.ts`

**Added** (lines 80-131): `ReadinessState`, `ReadinessIssueCode`, `ReadinessIssue`, `ReadinessSnapshot` after the `SecretKey` type. All exported in the export block (lines 159-162).

### 2. `client/src/lib/errors.ts`

**Added** (lines 197-230): `STORE_VALIDATION_ERROR_CODES` const, `StoreValidationErrorCode` and `StoreValidationErrorType` types, `StoreValidationError` class. All exported (lines 247-250).

### 3. `client/src/services/pass.ts`

**Added** (lines 147-168): `execScoped` method after the existing `exec` method:

```ts
async execScoped(
  env: Record<string, string>,
  args: Stringifiable[] = [],
  options?: ExecCommandOptions
): Promise<Result<ExecCommandResult>>
```

**Logic**: Build environment variable prefix string from `env` entries (each `KEY=value` with value quoted via `quoteForPosix`), validate args same as `exec()`, call `neu.execCmd` with the composed command. Uses `execCmd` (not `safeExec`) because the env-prefixed command string does not match the `ALLOWED_COMMANDS` whitelist.

### 4. `client/src/services/gpg.ts`

**Added** (lines 162-181): `listSecretKeysWithHome` method after `listSecretKeys`:

```ts
async listSecretKeysWithHome(gnupgHome: string): Promise<Result<SecretKey[]>>
```

**Logic**: Get resolved GPG command from `getCommand()`, build `GNUPGHOME="/path" gpg` prefix, call `neu.execCmd` with `--list-secret-keys --with-colons --fixed-list-mode` args, parse stdout with `parseSecretKeys()`.

### 5. `client/src/main.ts`

**Removed**: `import { passInitialized } from "@/services/pass"`, `import { gpgInitialized } from "./services/gpg"`, `await gpgInitialized`, `await passInitialized`. Only `import { neuInitialized }` and `await neuInitialized` remain. App mounts immediately without blocking on GPG/pass init promises.

## Implementation Steps (All Complete)

### Step 1: Define readiness types — DONE

**File**: `client/src/types/index.ts` (current lines 80-131)

Added 4 types after `SecretKey`:
- `ReadinessState`: union of 5 string literals
- `ReadinessIssueCode`: union of 13 string literals
- `ReadinessIssue`: object with `code`, `message`, optional `details`
- `ReadinessSnapshot`: metadata container with state, issues, pass/GPG info, store info, timestamp

All exported in the `export type { ... }` block.

### Step 2: Add StoreValidationError — DONE

**File**: `client/src/lib/errors.ts` (current lines 197-230)

Added `STORE_VALIDATION_ERROR_CODES` const object with 7 entries, extracted `StoreValidationErrorCode` and `StoreValidationErrorType` types, defined `StoreValidationError` class extending `Error` with `code`, `type`, and `details` fields. All exported.

### Step 3: Add execScoped to PassService — DONE

**File**: `client/src/services/pass.ts` (current lines 147-168)

Signature: `execScoped(env, args?, options?)` with `env: Record<string, string>` first parameter. Imports `quoteForPosix` from `@/lib/shell`. Builds env prefix string, validates args, calls `neu.execCmd`. Uses `execCmd` (not `safeExec`) because the env-prefixed command does not match the whitelist.

### Step 4: Add listSecretKeysWithHome to GpgService — DONE

**File**: `client/src/services/gpg.ts` (current lines 162-181)

Takes `gnupgHome: string`, builds `GNUPGHOME="/path" gpg` command, calls `neu.execCmd`, parses output with `parseSecretKeys()`.

### Step 5: Create store-validation.ts — DONE

**File**: `client/src/services/store-validation.ts` (199 lines, fully implemented)

Four exported functions:
- `validateStoreStructure(storePath)`: checks `fs.isDirectory`, `.gpg-id` exists and non-empty
- `parseGpgId(storePath)`: reads and parses `.gpg-id`, filters comments/empty lines
- `verifyRecipients(recipientIds, gnupgHome)`: checks each recipient against GPG keyring (suffix match for short IDs, exact for fingerprints)
- `validateStoreBehaviorally(storePath)`: runs `pass.execScoped(["ls"])` with scoped `PASSWORD_STORE_DIR`

All return `Promise<Result<..., StoreValidationError>>`.

### Step 6: Create app-readiness.ts — DONE

**File**: `client/src/services/app-readiness.ts` (244 lines, fully implemented)

Single exported function `checkReadiness(): Promise<Result<ReadinessSnapshot>>`. Runs the full validation pipeline in order:
1. Pass check → `PASS_NOT_FOUND` / `PASS_VERSION_UNSUPPORTED`
2. GPG check → `GPG_NOT_FOUND` / `GPG_NO_SECRET_KEYS`
3. Config + active store resolution → `STORE_CONFIG_MISSING` / `ACTIVE_STORE_UNDEFINED`
4. Store structure validation
5. Recipient parsing and verification
6. Behavioral check (`pass ls`)
7. State determination via `determineState()` helper

All checks run (no short-circuit). Contains `determineState()` function that classifies accumulated issues into the correct `ReadinessState` using priority ordering.

### Step 7: Create readiness Pinia store — DONE

**File**: `client/src/stores/readiness.ts` (64 lines, fully implemented)

Setup store with `snapshot`, `loading`, `lastCheckedAt` state. `checkReadiness()` calls the orchestrator, handles catastrophic failure by setting a minimal `DEPENDENCIES_MISSING` snapshot (prevents infinite loop in Phase 04 router guard). Exposes `isReady`, `blockingState`, `issues` computed properties. Does NOT auto-call `checkReadiness()` — the router guard or blocked page triggers it.

### Step 8: Update main.ts — DONE

**File**: `client/src/main.ts` (17 lines, already cleaned)

Removed all `gpgInitialized`/`passInitialized` imports and awaits. Only `neuInitialized` remains. App mounts immediately; readiness is lazy-initialized by the router guard or blocked page.

## Integration Points

This phase exposes these contracts consumed by Phase 03 (entry operations):

1. **`ReadinessSnapshot` type**: Phase 03 entry operations must check readiness before allowing listing/mutations.
2. **`checkReadiness()` orchestrator**: Single source of truth for whether the app can operate.
3. **`StoreValidationError`**: Store validation error types inform entry operations of structural issues.
4. **`PassService.execScoped(env, args, options)`**: Used by Phase 03 for listing/mutations with custom env scoping.
5. **`GpgService.listSecretKeysWithHome()`**: Used by Phase 03 for recipient re-verification after store switching.
6. **`ReadinessStore`**: Phase 04 frontend consumes this store for readiness-driven app entry.

## Verification Checklist

- [x] `pnpm typecheck` passes with all new types, methods, and services
- [x] `pnpm lint && pnpm format` passes
- [x] `checkReadiness()` returns `DEPENDENCIES_MISSING` when `pass` binary is not found
- [x] `checkReadiness()` returns `DEPENDENCIES_MISSING` when `pass` version is below 1.7.0
- [x] `checkReadiness()` returns `DEPENDENCIES_MISSING` when no `gpg`/`gpg2` binary exists
- [x] `checkReadiness()` returns `GPG_NOT_INITIALIZED` when `gpg` exists but has no secret keys
- [x] `checkReadiness()` returns `STORE_NOT_FOUND` when `active_store` references a non-existent store in config
- [x] `checkReadiness()` returns `STORE_NOT_FOUND` when the store path does not exist on disk
- [x] `checkReadiness()` returns `STORE_INVALID` when `.gpg-id` is missing from the store
- [x] `checkReadiness()` returns `STORE_INVALID` when `.gpg-id` is empty
- [x] `checkReadiness()` returns `STORE_INVALID` when `.gpg-id` contains a recipient not in the GPG keyring
- [x] `checkReadiness()` returns `STORE_INVALID` when `pass ls` exits non-zero for the store
- [x] `checkReadiness()` returns `READY` when all checks pass
- [x] `ReadinessSnapshot.checkedAt` is a valid timestamp
- [x] `ReadinessSnapshot.issues` is empty when state is `READY`
- [x] `ReadinessStore.loading` is true during check, false after
- [x] `ReadinessStore.isReady` is true only when state is `READY`
- [x] `ReadinessStore.blockingState` returns the correct non-READY state label
- [x] GNUPGHOME env var resolution works (per-store → env → gpg.homeDir → empty)
- [x] Store paths with `~` are correctly expanded
- [x] `main.ts` does not import or await `gpgInitialized` or `passInitialized`
- [x] `neuInitialized` is still imported and awaited in `main.ts`
