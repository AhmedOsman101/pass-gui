# Entry Operations — Implementation Plan

> **Spec**: `docs/specs/entry-operations.md`
> **Roadmap**: `docs/roadmap/03-entry-and-operations-backend.md`
> **Depends on**: Phase 02 (backend readiness) completely implemented

**Goal**: Build the backend password-management operations — listing, detail,
mutations, clipboard, and state contracts — that the frontend will consume.

**Architecture**: Add domain types for entries, a parser layer for `pass`
output, a clipboard service, and a top-level entries service that orchestrates
all entry operations. Keep services focused on command execution; move parsing
to dedicated functions. No UI code in this phase.

**Tech Stack**: Vue 3 + TypeScript + lib-result + NeutralinoJS clipboard API

---

## New Files

| File | Purpose |
|------|---------|
| `client/src/types/entries.ts` | Entry domain types (tree, detail, mutation, clipboard contracts) |
| `client/src/lib/parse-pass-ls.ts` | Parse `pass ls` output into entry tree |
| `client/src/lib/parse-pass-show.ts` | Parse `pass show` output into entry detail model |
| `client/src/services/entries.ts` | EntriesService: list, show, insert, generate, rm, mv, edit |
| `client/src/services/clipboard.ts` | ClipboardService: write, clear, timer management |

## Modified Files

| File | Change |
|------|--------|
| `client/src/lib/errors.ts` | Add EntryNotFoundError, EntryParseError, ClipboardError, MutationError |
| `client/src/lib/constants.ts` | No changes needed unless new constants emerge |
| `client/src/types/index.ts` | May re-export from entries.ts if convention dictates |
| `client/src/services/pass.ts` | No changes needed (already handles scoped exec). Only if scoping gaps are found |
| `client/src/services/gpg.ts` | No changes needed |
| `client/src/services/config.ts` | No changes needed |
| `TODO.md` | Mark entry ops items done |

---

## Implementation Order

Phase 3 splits into 6 independent sub-phases. They are ordered so each builds
on the one before, but internal steps within each should be done in order.

### Sub-phase 3.1: Entry Domain Types

Define the types that every other component in this phase will use.

**Files:** `client/src/types/entries.ts`

- `EntryTree`: recursive type for folder/file structure
- `EntryNode`: individual tree node (name, path, type: folder|file, children?)
- `EntryDetail`: secret, metadata (Record<string, string>), rawPath
- `MutationInput`: path, content, force? for insert
- `MutationResult`: success, path, oldPath? for rename
- `ClipboardAction`: path, selection, timerSeconds
- `EntriesState`: nodes[], selectedPath?, loading, error

### Sub-phase 3.2: Pass Output Parsers

Pure functions that parse `pass` CLI output into the domain types. No service
calls, no side effects.

**Files:** `client/src/lib/parse-pass-ls.ts`, `client/src/lib/parse-pass-show.ts`

- `parsePassLsOutput(stdout: string): Result<EntryTree, EntryParseError>`
  - Handle empty output (empty store) → empty tree
  - Parse indentation-based tree format
  - Distinguish folders (trailing `/`) from files
  - Preserve full relative paths

- `parsePassShowOutput(stdout: string): Result<EntryDetail, EntryParseError>`
  - First line = secret (password)
  - Remaining lines = optional metadata
  - Split metadata on first `:` → key/value pairs
  - Lines without `:` go into an `other` array
  - Handle single-line entries (secret only, no metadata)

### Sub-phase 3.3: Entries Service

Wraps `pass` CLI commands and returns typed results.

**Files:** `client/src/services/entries.ts`

- `list(): Promise<Result<EntryTree, PassError | EntryParseError>>`
  - Calls `pass ls` via PassService
  - Passes output through `parsePassLsOutput`
  - Scopes to active store

- `show(path: string): Promise<Result<EntryDetail, PassError | EntryParseError>>`
  - Validates path safety
  - Calls `pass show <path>` via PassService
  - Passes output through `parsePassShowOutput`
  - Returns EntryNotFoundError for missing entries

- `insert(path: string, content: string, force?: boolean): Promise<Result<MutationResult, PassError | EntryAlreadyExistsError>>`
  - Calls `pass insert` with appropriate flags
  - Generates multi-line content for metadata
  - Returns clear error if entry exists and force not set

- `generate(path: string, length?: number, noSymbols?: boolean): Promise<Result<MutationResult, PassError>>`
  - Reads generation config from ConfigService
  - Calls `pass generate` with configured flags
  - Returns generated password in result for immediate clipboard use

- `remove(path: string): Promise<Result<MutationResult, PassError>>`
  - Calls `pass rm`
  - Returns success only

- `move(oldPath: string, newPath: string): Promise<Result<MutationResult, PassError>>`
  - Calls `pass mv`
  - Returns old and new path in result

- `edit(path: string): Promise<Result<MutationResult, PassError>>`
  - Calls `pass edit`
  - Note: this spawns EDITOR — may require NeutralinoJS terminal or
    graceful fallback. Consider deferring or documenting the limitation.

### Sub-phase 3.4: Clipboard Service

Manages clipboard operations with config-backed timer.

**Files:** `client/src/services/clipboard.ts`

- `write(text: string): Promise<Result<ClipboardAction, ClipboardError>>`
  - Uses NeutralinoJS `clipboard.writeText()`
  - Reads `clipboard.clear_after_seconds` and `clipboard.selection` from config
  - Stores timer reference for potential abort
  - Returns ClipboardAction with timer info

- `clear(): Promise<Result<void, ClipboardError>>`
  - Clears clipboard immediately
  - Aborts pending timer if any

- `abortTimer(): void`
  - Cancels pending clear timer
  - Called on manual clear or lifecycle boundary

Design notes:
- Timer uses `setTimeout` in a manager, not in the UI.
- ClipboardClearTimer is an internal concern; the service exposes `write`
  and `clear` and manages the timer as a private implementation detail.
- The composable (future, in phase 4) will expose reactive timer state.

### Sub-phase 3.5: Error Types

**Files:** `client/src/lib/errors.ts`

Add these error classes following existing patterns:

- `EntryNotFoundError` extends `PassError` with type `EntryNotFound`
- `EntryAlreadyExistsError` extends `PassError` with type `EntryAlreadyExists`
- `EntryParseError` extends `PassError` with type `EntryParseError`
- `ClipboardError` extends `NeuError` with type `ClipboardError`
- `MutationError` extends `PassError` with type `MutationFailed`

Each should carry metadata:
- `path?: string` for path-related errors
- `exitCode?: number` for command failures
- `stderr?: string` for debugging

### Sub-phase 3.6: State Contracts

Define the TypeScript contracts that Pinia stores will later implement. These
are types in `client/src/types/entries.ts`, not actual store code.

- `EntriesStoreContract`: list(), show(), insert(), generate(), remove(),
  move(), refresh(), state: EntriesState
- `ClipboardStoreContract`: write(text), clear(), state: ClipboardState
- `ClipboardState`: lastAction: ClipboardAction | null, remainingSeconds?,
  isActive: boolean

These contracts are the stable boundary between phase 03 and phase 04. The
frontend phase will implement the concrete Pinia stores from these contracts.

---

## Verification

```bash
pnpm typecheck                              # Must pass
pnpm lint && pnpm format                    # Must pass
```

Manual scenario verification:

1. **Entry listing**: App calls `entriesService.list()` and receives a tree
   matching the actual store structure.
2. **Empty store**: If no passwords exist, list returns empty tree (not error).
3. **Entry detail**: App calls `entriesService.show("path/to/entry")` and
   receives secret + metadata correctly separated.
4. **Insert**: App inserts a new entry and it appears in the next listing.
5. **Generate**: App generates a password and receives it back in the result.
6. **Remove**: App removes an entry and it disappears from listing.
7. **Move**: App renames an entry and old path fails, new path resolves.
8. **Clipboard**: App writes to clipboard, reads back via NeutralinoJS
   clipboard API, verifies content matches. After configured delay, clipboard
   is cleared.
9. **Clipboard abort**: Manual clear aborts pending timer.
10. **Edge cases**: Entry paths with spaces, special characters, nested
    folders (3+ levels deep).

---

## Risks And Watchouts

- **`pass edit` spawns an editor**: NeutralinoJS does not support terminal
  UIs natively. `pass edit` may not work in the app context. Consider
  replacing with in-app content editing + `pass insert -f` for edits.
- **Clipboard API availability**: NeutralinoJS clipboard API may not support
  `primary`/`secondary` selections on all platforms. Add platform detection
  and graceful fallback to `clipboard`.
- **Large stores**: `pass ls` on stores with thousands of entries may be slow.
  Consider caching and incremental refresh later, not in this phase.
- **Path safety**: All user-supplied paths must go through `validatePath()`
  to prevent directory traversal.

---

## Progress Tracking

Update `TODO.md` sections when complete:

- Section 5 (Listing Passwords) — mark all items
- Section 8 (Entry Operations) — mark all items
- Section 9 (Security Hardening) — mark clipboard items
