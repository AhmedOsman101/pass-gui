# Onboarding State Machine — Quest Chain

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Progress

- [x] Quest 1: The Type Codex
- [x] Quest 2: The Error Ledger
- [x] Quest 3: The Whitelist Amendment
- [x] Quest 4: The Store Inspector
- [x] Quest 5: The Orchestrator
- [x] Quest 6: The First Breath
- [x] Quest 7: The Ledger Update

**Goal:** Build a backend readiness state machine that tells the app exactly what's broken — missing binaries, no GPG keys, busted stores — so the UI (Phase 04) can show the right onboarding screen.

**Tech Stack:** TypeScript 5.9, lib-result (`Result<T, E>`), existing service layer (NeutralinoService, GpgService, PassService, filesystem).

---

## The World

The app has six service singletons under `client/src/services/`. They already know how to find binaries, check versions, list GPG keys, and read files. What they _don't_ know is how to compose all of that into a single "are we ready to go?" answer. That's what we're building.

Right now, `main.ts` just blindly awaits service inits and hopes for the best. We're adding a new layer that says: "here's exactly what's wrong, here's the state, deal with it."

**Skip Windows.** Linux and macOS only.

---

## The State Machine

Evaluation order is fixed. First match wins. Each state implies everything before it passed.

|  #  | State                      | What it means                                      | Blocking? |
| :-: | -------------------------- | -------------------------------------------------- | --------- |
|  1  | `NEED_PASS`                | `pass` binary not found or version < 1.7.0         | yes       |
|  2  | `NEED_TREE`                | `tree` binary not found — `pass ls` depends on it  | yes       |
|  3  | `NEED_GPG`                 | `gpg` or `gpg2` not found                          | yes       |
|  4  | `GPG_NO_KEYS`              | GPG installed but zero secret keys in keyring      | yes       |
|  5  | `STORE_NOT_FOUND`          | Store directory doesn't exist or isn't a directory | yes       |
|  6  | `STORE_NO_GPG_ID`          | Store exists but `.gpg-id` file missing            | yes       |
|  7  | `STORE_GPG_ID_EMPTY`       | `.gpg-id` exists but is empty                      | yes       |
|  8  | `STORE_GPG_ID_KEY_MISSING` | `.gpg-id` references a key not in keyring          | yes       |
|  9  | `STORE_EMPTY`              | Valid store, no password entries yet               | no (info) |
| 10  | `READY`                    | All good                                           | no        |

**Why `NEED_TREE` is its own state:** `pass` can install without `tree` on many distros and macOS Homebrew. `pass ls` shells out to `tree` — without it, listing dies silently. Catching it early means the onboarding screen says "install tree" instead of showing a cryptic error.

**Why `STORE_EMPTY` is informational:** An empty store with a valid `.gpg-id` is _correct_ — user just ran `pass init`. The UI should prompt them to insert their first password, not show an error.

---

## Issue Codes

Every state produces zero or more `ReadinessIssue` objects. Each has a `code`, `severity`, and context fields:

|  #  | Code                            | Context fields       | When it fires                 |
| :-: | ------------------------------- | -------------------- | ----------------------------- |
| 01  | `PASS_BINARY_MISSING`           | —                    | pass not installed            |
| 02  | `PASS_VERSION_TOO_OLD`          | `found`, `required`  | pass < 1.7.0                  |
| 03  | `TREE_BINARY_MISSING`           | —                    | tree not installed            |
| 04  | `GPG_BINARY_MISSING`            | —                    | gpg/gpg2 not installed        |
| 05  | `GPG_NO_SECRET_KEYS`            | —                    | GPG installed, no secret keys |
| 02  | `GPG_VERSION_TOO_OLD`           | `found`, `required`  | gpg < 2.1                     |
| 06  | `STORE_DIR_NOT_FOUND`           | `path`               | Store dir doesn't exist       |
| 07  | `STORE_DIR_NOT_DIRECTORY`       | `path`               | Path exists but isn't a dir   |
| 08  | `STORE_GPG_ID_MISSING`          | `path`               | .gpg-id not found             |
| 09  | `STORE_GPG_ID_EMPTY`            | `path`               | .gpg-id is empty              |
| 10  | `STORE_GPG_ID_PARSE_ERROR`      | `path`, `parseError` | .gpg-id has bad format        |
| 11  | `STORE_RECIPIENT_UNKNOWN`       | `path`, `keyId`      | Recipient not in keyring      |
| 12  | `STORE_BEHAVIORAL_CHECK_FAILED` | `path`, `stderr`     | `pass ls` failed              |
| 13  | `STORE_NO_ENTRIES`              | `path`               | Store has no passwords (info) |

---

## Quest Chain

Complete these in order. Each quest unlocks the next.

---

### Quest 1: The Type Codex

> _"Before you can build the machine, you need the language to describe it."_

**Reward:** Types that every other quest depends on.

**Where to work:**

- Create `client/src/types/readiness.ts`
- Modify `client/src/types/index.ts`

**What to build:**

A new type file containing three exports:

1. **`ReadinessState`** — A string union of all 10 states listed above. This is the "current state" enum.
2. **`ReadinessIssue`** — A discriminated union. Each variant has a `code` (the string literal from the issue table), a `severity` (`"blocking"` or `"informational"`), and variant-specific context fields (like `path`, `keyId`, `found`/`required` for version). Study the issue table above — every row becomes one variant.
3. **`ReadinessSnapshot`** — An object with `state: ReadinessState`, `issues: ReadinessIssue[]`, and `evaluatedAt: number` (a `Date.now()` timestamp).

Also add a `ReadinessIssueSeverity` type alias for `"blocking" | "informational"` for reuse.

**How to follow existing patterns:** Look at `client/src/types/index.ts` — it uses `type` (not `interface`), explicit exports at the bottom, and JSDoc on everything. Follow that.

**Re-export from index.ts:** Add a re-export block at the bottom of `client/src/types/index.ts` for all four types from the new file.

**Done when:** `pnpm typecheck` passes with no errors.

**Commit:** `feat(types): add readiness state machine types`

---

### Quest 2: The Error Ledger

> _"Every failure needs a name."_

**Reward:** Structured error classes for store validation failures.

**Where to work:**

- Modify `client/src/lib/errors.ts`

**What to build:**

Append to the existing errors file:

1. A `STORE_ERROR_CODES` frozen object mapping code strings (like `"STORE_DIR_NOT_FOUND"`) to human-readable type strings (like `"StoreDirNotFound"`). Cover all store-related issue codes from the table above (7 codes).
2. A `StoreErrorCode` type (keyof the codes object) and `StoreErrorType` (value type).
3. A `StoreValidationError` class extending `Error` with three fields: `code: StoreErrorCode`, `type: StoreErrorType`, `storePath: string`. Constructor takes `(code, storePath, message?, options?)`.

**How to follow existing patterns:** Look at how `NeuError` and `ConfigNotFoundError` are structured in the same file. Same pattern: frozen codes object, type aliases, Error subclass with typed fields.

**Done when:** `pnpm typecheck` passes.

**Commit:** `feat(errors): add StoreValidationError and store error codes`

---

### Quest 3: The Whitelist Amendment

> _"The machine needs to know about `tree`."_

**Reward:** `tree` is a legal command the system can check for.

**Where to work:**

- Modify `client/src/types/index.ts` — add `"tree"` to the `AllowedCommand` union type
- Modify `client/src/services/neutralino.ts` — add `"tree"` to the `ALLOWED_COMMANDS` array

**Why:** `neu.commandExists()` uses this whitelist. Without `tree` in the list, we can't check if it's installed.

**Done when:** `pnpm typecheck` passes.

**Commit:** `feat(neutralino): add tree to allowed commands for pass ls support`

---

### Quest 4: The Store Inspector

> _"A store is more than a directory with a file in it."_

**Reward:** A service that can parse `.gpg-id`, verify recipients against the keyring, run `pass ls`, and tell you if the store has any entries.

**Where to work:**

- Create `client/src/services/store-validation.ts`

**What to build:**

A `StoreValidationService` class with four static methods:

1. **`parseGpgId(storePath)`** -> `Result<ParsedRecipient[]>`
   - Read `{storePath}/.gpg-id`
   - Split by newlines, for each line: strip everything after `#` (inline comments), then trim whitespace
   - Skip lines that are now empty
   - Pass remaining strings through — don't hard-validate hex format (pass doesn't). GPG itself will reject bad recipients. Optionally add soft hex validation as a UX warning.
   - Return an error if the file is empty after filtering
   - Each recipient object has: `raw` (original line before stripping), `keyId` (the stripped value), `isFingerprint` (true if exactly 40 hex chars)

2. **`verifyRecipients(recipients, gnupgHome?)`** -> `Result<RecipientValidation>`
   - Fetch all secret keys from the keyring using `gpg.listSecretKeys()` or `gpg.listSecretKeysWithHome()` depending on whether `gnupgHome` is provided
   - For each recipient, check if it matches any key: fingerprints get exact match, short IDs get suffix match (the recipient string must be a suffix of the key's fingerprint or keyId field)
   - Return `{ recipients, missingKeys: string[] }` — `missingKeys` lists any recipient IDs that weren't found

3. **`validateBehavior(storePath, gnupgHome?)`** -> `Result<void>`
   - Run `pass ls` scoped to the given store path (and optional GNUPGHOME)
   - Use `pass.execScoped()` with the appropriate env vars
   - Return error if `pass ls` fails

4. **`hasEntries(storePath)`** -> `boolean`
   - Run `pass ls` scoped to the store path
   - If it succeeds -> store has entries (return true)
   - If it fails AND stderr contains "password store is empty" -> store is empty (return false)
   - If it fails for other reasons -> return false (we can't determine emptiness, let the behavioral check handle it)

**Types to define locally:** `ParsedRecipient` and `RecipientValidation`. These are internal to this service, not exported to the global types.

**How to follow existing patterns:** Study `client/src/services/pass.ts` and `client/src/services/gpg.ts` — same class-with-static-methods pattern, `Result<T, E>` returns, `ErrFromText` for error creation, imports from `lib-result`.

**How pass actually parses `.gpg-id`** (from `password-store.sh` line 104-109):

```bash
while read -r gpg_id; do
    gpg_id="${gpg_id%%#*}"   # strip comment from END of line
    [[ -n ${gpg_id} ]] || continue
    GPG_RECIPIENT_ARGS+=("-r" "${gpg_id}")
done <"${current}"
```

Key insight: comments are stripped from the **end** of a line, not just whole-line comments. So `DEADBEEF # my key` becomes `DEADBEEF`. Your parser must do the same — split on `#`, take the left side, trim whitespace.

**How `pass ls` detects empty stores** (from `password-store.sh` line 424-425):

```bash
elif [[ -z ${path} ]]; then
    die "Error: password store is empty. Try \"pass init\"."
```

`pass ls` on an empty store **exits non-zero** with that exact error message. So `hasEntries()` should run `pass ls` and check: if it fails AND stderr contains "password store is empty", the store is empty. No line-counting heuristic needed — that's the actual signal.

**How `pass ls` displays entries** (from `password-store.sh` line 423):

```bash
tree -N -C -l --noreport "${PREFIX}/${path}" | tail -n +2 | sed -E 's/\.gpg(...)/\1/g'
```

`pass` calls `tree` directly with `-N` (no icons), `-C` (color), `-l` (follow symlinks), `--noreport` (no summary line). It then strips the first line (tree root) and removes `.gpg` extensions from the output. This confirms `tree` is a hard dependency for listing.

**How `.gpg-id` lookup walks up directories** (from `password-store.sh` line 85-89):

```bash
local current="${PREFIX}/$1"
while [[ ${current} != "${PREFIX}" && ! -f ${current}/.gpg-id ]]; do
    current="${current%/*}"
done
```

Pass walks **up** from the current subfolder looking for `.gpg-id`. A `.gpg-id` in a parent directory applies to all subdirectories. Your `parseGpgId()` should accept a `storePath` that might be a subdirectory, not just the store root. For the readiness check, always pass the store root path — but be aware this behavior exists for later multi-directory support.

**Edge cases to handle:**

- `.gpg-id` is a directory instead of a file -> error
- `.gpg-id` contains only comments (all lines stripped to empty) -> treated as empty -> error
- `.gpg-id` has a line with non-hex characters (e.g., an email address like `user@example.com`) -> pass doesn't validate this — it passes raw to GPG `-r`. GPG will reject it. Your parser should be lenient (like pass) and let GPG be the validator, but you CAN optionally validate hex format as a UX improvement. If you do validate, mark it as a soft warning, not a hard error.
- Keyring listing fails (gpg agent locked, permission denied) -> bubble up the error
- GPG groups (e.g., `@myteam` in `.gpg-id`) -> pass resolves these via `gpg --list-config`. Your parser should pass these through as-is (don't reject them). Verification against keyring will naturally fail for groups — that's fine, the behavioral check (`pass ls`) will catch it.

**Done when:** `pnpm typecheck` passes.

**Commit:** `feat(store-validation): add .gpg-id parsing, recipient verification, behavioral check`

---

### Quest 5: The Orchestrator

> _"One service to rule them all."_

**Reward:** The main readiness check — call one method, get a snapshot.

**Where to work:**

- Create `client/src/services/readiness.ts`

**What to build:**

A `ReadinessService` class with one public static method: `check(storePath)` -> `Promise<ReadinessSnapshot>`.

The method runs checks in strict order. **First blocking match wins** — if `pass` is missing, don't bother checking GPG keys.

**The check sequence (each is a private static method):**

1. **checkPass()** — Call `pass.passExists()`. If not found or version too old (`pass.checkVersion(pass.version)` is false against `PASS_MIN_VERSION` from `@/lib/constants`), return state `NEED_PASS` with appropriate issue and `stop: true`.

2. **checkTree()** — On Windows, skip (return READY, no stop). On Linux/macOS, call `neu.commandExists("tree")`. If missing, return `NEED_TREE` with stop.

3. **checkGpg()** — Call `gpg.gpgExists()`. If not found, return `NEED_GPG` with stop.

4. **checkGpgKeys()** — Call `gpg.listSecretKeys()`. If error or empty array, return `GPG_NO_KEYS` with stop.

5. **checkStore(storePath)** — This is the big one, a chain of sub-checks:
   - `fs.exists(storePath)` -> if missing, `STORE_NOT_FOUND`
   - `fs.isDirectory(storePath)` -> if not dir, `STORE_NOT_FOUND` (with `STORE_DIR_NOT_DIRECTORY` issue)
   - `fs.exists({storePath}/.gpg-id)` -> if missing, `STORE_NO_GPG_ID`
   - `StoreValidationService.parseGpgId(storePath)` -> if empty, `STORE_GPG_ID_EMPTY`; if parse error, `STORE_GPG_ID_PARSE_ERROR`
   - Look up the store's `gnupg_home` from config (try `ConfigService.getValue("stores")`, match by path, return null if config unavailable)
   - `StoreValidationService.verifyRecipients(recipients, gnupgHome)` -> if missing keys, `STORE_GPG_ID_KEY_MISSING`
   - `StoreValidationService.validateBehaviorally(storePath, gnupgHome)` -> if fails, `STORE_BEHAVIORAL_CHECK_FAILED`
   - If all pass, return READY

6. **checkStoreEmpty(storePath)** — Only runs if state is still READY. Call `StoreValidationService.hasEntries()`. If false, set state to `STORE_EMPTY` with informational issue (but keep state as `READY` if you want — the issue alone signals this to the UI).

**Each private check method** returns `{ state, issues, stop }` — a ReadinessState, an array of ReadinessIssue objects, and a boolean indicating whether to short-circuit.

**How to follow existing patterns:** The return-objects pattern (state + issues + stop) is similar to how services return `Result<T, E>` — structured data, no throwing. Import types from `@/types/readiness`, services from their files, constants from `@/lib/constants`.

**Done when:** `pnpm typecheck` passes.

**Commit:** `feat(readiness): add readiness orchestrator service`

---

### Quest 6: The First Breath

> _"Plug it in and watch it think."_

**Reward:** The readiness check actually runs on app startup.

**Where to work:**

- Modify `client/src/main.ts`

**What to do:**

After the existing `await passInitialized` line, add:

1. Import `ReadinessService` from `@/services/readiness` and `pass` from `@/services/pass`
2. Get the store path from `pass.storeDirectory`
3. Call `ReadinessService.check(storePath)`
4. Log the result to Neutralino's debug console (`debug.log`) — the state and each issue code

This is temporary. The Pinia readiness store (Phase 04) will consume this properly. For now, we just want to see it working in the Neutralino inspector.

**Gotcha:** `pass.storeDirectory` is only set after `pass.init()` resolves, which is what `passInitialized` awaits. So by the time we call `ReadinessService.check()`, the directory is available.

**Done when:** `pnpm typecheck` passes.

**Commit:** `feat(main): wire readiness check into init flow`

---

### Quest 7: The Ledger Update

> _"Mark your victories in the scroll."_

**Reward:** TODO.md reflects what's been done.

**Where to work:**

- Modify `TODO.md`

**What to check off** (these are now implemented by the readiness state machine):

- Section 1.1: "Diagnose and report pass readiness" -> covered by `NEED_PASS` + `NEED_TREE`
- Section 1.2: "Ensure at least one secret key exists" -> `GPG_NO_KEYS`
- Section 1.2: "Detect and support custom GNUPGHOME" -> orchestrator reads per-store `gnupg_home` from config
- Section 1.2: "Resolve effective GNUPGHOME" -> `verifyRecipients()` accepts optional `gnupgHome`
- Section 3.1: "Ensure .gpg-id is not empty" -> `STORE_GPG_ID_EMPTY`
- Section 3.2: "Parse .gpg-id" -> `StoreValidationService.parseGpgId()`
- Section 3.2: "Verify each key ID exists in GPG keyring" -> `StoreValidationService.verifyRecipients()`
- Section 3.2: "Detect unknown/removed recipients" -> `STORE_RECIPIENT_UNKNOWN` issue code
- Section 3.3: "Attempt a safe read operation (pass ls)" -> `StoreValidationService.validateBehaviorally()`
- Section 3.3: "Fail and report STORE_BEHAVIORAL_CHECK_FAILED" -> `STORE_BEHAVIORAL_CHECK_FAILED` issue code
- Section 4: All five states (`DEPENDENCIES_MISSING` through `READY`) -> replaced by our 10-state machine
- Section 4: "Centralized state manager" -> `ReadinessService.check()`

**Leave unchecked:** "Provide onboarding flow if pass doesn't exist" (Phase 04), "Provide onboarding flow if no keys exist" (Phase 04), "Handle Windows-specific GPG installations" (out of scope), "UI reacts strictly to state changes" (Phase 04).

**Commit:** `docs: update TODO.md with readiness state machine completions`

---

## Verification

No test framework yet. Manual verification:

1. **Typecheck must pass:** `pnpm typecheck` after every quest
2. **Lint must pass:** `pnpm lint && pnpm format` after every quest
3. **Smoke test after Quest 6:** Run `pnpm dev`, open Neutralino inspector console, check the readiness log output:
   - System with pass + gpg + tree + valid store -> `Readiness: READY (0 issues)` or `READY` with `STORE_NO_ENTRIES` info
   - Uninstall or hide `tree` -> `Readiness: NEED_TREE (1 issues)` with `TREE_BINARY_MISSING`
   - Uninstall or hide `pass` -> `Readiness: NEED_PASS (1 issues)` with `PASS_BINARY_MISSING`
4. **Edge case — empty .gpg-id:** `touch ~/.password-store/.gpg-id` -> expect `STORE_GPG_ID_EMPTY`
5. **Edge case — wrong key:** `echo "DEADBEEF" > ~/.password-store/.gpg-id` -> expect `STORE_GPG_ID_KEY_MISSING` + `STORE_RECIPIENT_UNKNOWN`
6. **Edge case — empty store:** Valid .gpg-id, no .gpg files -> `pass ls` fails with "password store is empty" -> expect `READY` + `STORE_NO_ENTRIES` informational

---

## Open Questions

1. **`pass ls` on empty store** — Now resolved. Pass exits non-zero with `"Error: password store is empty. Try \"pass init\"."` The `hasEntries()` method uses this exact signal. No heuristic needed.

2. **GPG groups in `.gpg-id`** — Pass resolves `@group` names via `gpg --list-config`. Your parser should pass them through as-is (don't reject `@` prefixed strings). Verification against keyring will fail for groups, but the behavioral check (`pass ls`) will catch real problems. Out of scope for now.

3. **`.gpg-id` comment format** — Now resolved from source. Comments are stripped from the **end** of lines (`${gpg_id%%#*}`), not just whole-line `#` comments. Parser must match this behavior.

4. **Config availability:** The orchestrator looks up `gnupg_home` from config via dynamic import. If config isn't loaded yet when readiness runs, the override won't be used — default GNUPGHOME applies. Acceptable for now, should be revisited when init flow is refactored.

5. **NixOS/Guix `tree` path:** Some Nix-based distros might not put `tree` in PATH normally. If `commandExists("tree")` fails, users may need to add it to their shell profile. Documentation issue, not a code issue.

6. **Multiple stores:** The orchestrator takes a single `storePath`. When multi-store switching ships (TODO 6.1), this should be called per-store or return per-store results. Out of scope here.

7. **Windows:** Explicitly skipped. When Windows support is added, `checkTree()` needs a `where.exe tree` check or equivalent. The current code returns READY immediately on Windows.
