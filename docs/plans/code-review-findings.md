# Code Review Findings — Review Fixes Phase

> Captured from the code review that produced the `review-fixes` plan.
> This file preserves the findings so they can be revisited later.

**Date**: April 5, 2026
**Linked Plan**: `docs/plans/review-fixes.md`
**Linked Spec**: `docs/specs/backend-readiness.md`

---

## Resolved Issues (Fixed)

### 1. Wrong error type in `filesystem.writeFile`
- **File**: `client/src/services/filesystem.ts`
- **Issue**: `writeFile` was catching failures and throwing `DirectoryCreationError` instead of a file-write-specific error.
- **Fix**: Added `FileWriteError` class to `client/src/lib/errors.ts` and updated `writeFile` to use it.
- **Status**: ✅ Resolved

### 2. Home-directory resolution in `lib/path.ts`
- **File**: `client/src/lib/path.ts`
- **Issue**: `getHomeDir()` threw async errors instead of returning `Result<string>`, inconsistent with the project's `Result`-based error handling.
- **Fix**: Standardized to return `Result<string>` for all OS branches.
- **Status**: ✅ Resolved

### 3. NeutralinoService initialization error handling
- **File**: `client/src/services/neutralino.ts`
- **Issue**: `init()` relied on thrown errors from `Path.getHomeDir()` rather than handling `Result` returns.
- **Fix**: Updated to consume `Result` from `getHomeDir()` and throw the wrapped error explicitly.
- **Status**: ✅ Resolved

### 4. Fragile binary path resolution (symlink parsing)
- **File**: `client/src/services/neutralino.ts`
- **Issue**: `resolveBinaryPath` parsed `ls -l` output to detect symlinks — fragile and platform-dependent.
- **Fix**: Simplified to use `which` + `readlink -f` on Unix, `where.exe` on Windows.
- **Status**: ✅ Resolved

### 5. Store service mutation/type assertions
- **File**: `client/src/services/store.ts`
- **Issue**: Unsafe mutation and type-assertion patterns in `set()` method.
- **Fix**: Cleaned up to use proper `Result` mapping without unsafe casts.
- **Status**: ✅ Resolved

### 6. `commandExists` simplification
- **File**: `client/src/services/neutralino.ts`
- **Issue**: Overly complex command existence detection.
- **Fix**: Simplified to direct `which`/`where.exe` calls with proper `Result` returns.
- **Status**: ✅ Resolved

---

## Unresolved / Deferred Issues

### 1. Lowercase `fs` class naming
- **File**: `client/src/services/filesystem.ts`
- **Issue**: The class is named `fs` (lowercase), which deviates from the project's `PascalCase` convention for classes.
- **Impact**: Cosmetic/style only. No behavioral risk.
- **Status**: ⏸ Deferred — low priority, may be addressed in a future cleanup pass.

### 2. Overly broad exports in service modules
- **Files**: Various service files
- **Issue**: Some modules export both the class and the singleton instance plus initialization promises, which creates a wide surface area.
- **Impact**: Minor — mostly affects tree-shaking clarity and import hygiene.
- **Status**: ⏸ Deferred — will be revisited during bootstrap architecture work.

### 3. Module-level initialization promises in `main.ts`
- **Files**: `client/src/main.ts`, `client/src/services/neutralino.ts`, `client/src/services/gpg.ts`, `client/src/services/pass.ts`
- **Issue**: Services initialize via module-level promises (`neuInitialized`, `gpgInitialized`, `passInitialized`) that are awaited in `main.ts`. This means:
  - All three must succeed before the app mounts.
  - Two of these (`gpg` and `pass`) should NOT block app execution — their failures belong to the future onboarding/state-machine flow.
  - Error stacks are lost or hard to trace when init fails at module load time.
- **Impact**: **Architectural** — this is the primary driver for the bootstrap redesign.
- **Status**: 🔵 Active — being redesigned in the bootstrap architecture phase.

### 4. `ErrFromUnknown` usage patterns
- **Files**: Multiple service files
- **Issue**: `ErrFromUnknown` should only be used as a true final fallback in catch blocks for genuinely unknown errors, not to wrap known constructed errors.
- **Impact**: Error-type clarity and downstream error handling.
- **Status**: ⚠️ Partially addressed — needs ongoing vigilance in new code.

---

## Verification

All resolved items were verified with:
- `pnpm typecheck` — passed
- `pnpm lint && pnpm format` — passed
